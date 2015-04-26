var fs = require('fs');
var cPath = '../coreos/certificates/';
var sslOptions = {
    key: fs.readFileSync(cPath + 'unsee.cc.key'),
    cert: fs.readFileSync(cPath + 'unsee.cc.crt')
};
var app = require('https').createServer(sslOptions).listen(3123);
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({server: app});
var sdk = require('./sdk.js');

sdk.Image.prototype.create = function () {
    console.log('Creating image', this.export());
    this.id = 'api.new.id';
};

wss.on('connection', function (ws) {
    ws.on('message', function (data) {
        var mess = new sdk.Message();
        var entity = mess.getEntity(data);

        if (!entity) {
            return false;
        }

        entity.process();

        // Send back as is
        var payload = entity.export();
        ws.send(payload);
    });

    ws.on('close', function () {
        console.log('Closed connection');
    });
});
