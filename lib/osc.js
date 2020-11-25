/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

var debug   = require('debug')('lib/osc');
var OSC     = require('osc')

var rgb = function(r, g, b) {
	return (
		((r & 0xff) << 16) |
		((g & 0xff) << 8) |
		(b & 0xff)
	);
};

/*
	Example usage of bundle scheduled after 60 seconds:

	system.emit('osc_send_bundle', host, port, 60, [
		{
			address: '/cmd/yes',
			args: [
				{ type: 'f', value: 1.0 }
			]
		},
		{
			address: '/cmd/somethingelse',
			args: [
				{ type: 's', value: 'hello' }
			]
		}
	]);
*/

class osc {

	constructor(system) {
		this.system = system;

		this.config = {};
		this.currentState = false;
		this.port = 12321;

		this.ready = false;

		this.system.on('osc_send', this.send.bind(this));

		this.system.on('osc_send_bundle', this.sendBundle.bind(this));

		this.enableModule();
	}

	enableModule() {
		try {
			this.listen();
			this.currentState = true;
			this.system.emit('log', 'osc', 'debug', 'Listening on port ' + this.port);
		}
		catch(e) {
			console.log("Error listening for osc",e);
		}
	}

	listen() {

		if (this.socket === undefined) {
			this.socket = new OSC.UDPPort({
				localAddress: "0.0.0.0",
				localPort: this.port,
				broadcast: true,
				metadata: true
			});
	
			this.socket.open();
	
			this.socket.on("ready", () => {
				this.ready = true;
			});
	
			this.socket.on("message", this.processIncoming.bind(this));
		}
	}

	processIncoming(message) {
		var a = message.address.split("/");

		if (message.address.match(/^\/press\/bank\/\d+\/\d+$/)) {

			if (message.args.length == 0) {

				debug("Got /press/bank/ (trigger)",parseInt(a[3]),"button",parseInt(a[4]));
				this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), true);

				setTimeout(() => {
					debug("Auto releasing /press/bank/ (trigger)",parseInt(a[3]),"button",parseInt(a[4]));
					this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false);
				}, 20);
			}
			else {

				if (message.args[0].type == 'i' && message.args[0].value == '1') {
					debug("Got /press/bank/ (press) for bank", parseInt(a[3]), "button", parseInt(a[4]));
					this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), true);
				}
				else if (message.args[0].type == 'i' && message.args[0].value == '0') {
					debug("Got /press/bank/ (release) for bank", parseInt(a[3]), "button", parseInt(a[4]));
					this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false);
				}
			}
		}
		else if (message.address.match(/^\/style\/bgcolor\/\d+\/\d+$/)) {
			if (message.args.length > 2) {
				var r = message.args[0].value;
				var g = message.args[1].value;
				var b = message.args[2].value;
				if (typeof r === "number" && typeof g === "number" && typeof b === "number") {
					var col = rgb(r, g, b);
					debug("Got /style/bgcolor", parseInt(a[3]), "button", parseInt(a[4]))
					this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'bgcolor', col);
					this.system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]));
				}
			}
		}
		else if (message.address.match(/^\/style\/color\/\d+\/\d+$/)) {
			if (message.args.length > 2) {
				var r = message.args[0].value;
				var g = message.args[1].value;
				var b = message.args[2].value;
				if (typeof r === "number" && typeof g === "number" && typeof b === "number") {
					var col = rgb(r, g, b);
					debug("Got /style/color", parseInt(a[3]), "button", parseInt(a[4]))
					this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'color', col);
					this.system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]));
				}
			}
		}
		else if (message.address.match(/^\/style\/text\/\d+\/\d+$/)) {
			if (message.args.length > 0) {
				var text = message.args[0].value;
				if (typeof text === "string") {
					debug("Got /style/text", parseInt(a[3]), "button", parseInt(a[4]))
					this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'text', text);
					this.system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]));
				}
			}
		}		
	}

	send(host, port, path, args) {

		if (this.socket !== undefined) {
			this.socket.send({
				address: path,
				args: args
			}, host, port);
		}
	}

	sendBundle(host, port, time, bundle) {

		if (this.socket !== undefined) {
			this.socket.send({
				timeTag: OSC.timeTag(time),
				packets: bundle
			}, host, port);
		}
	}
}

exports = module.exports = function (system) {
	return new osc(system);
};
