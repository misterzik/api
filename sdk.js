(function (exports) {

    // Message abstraction

    function Message() {
        this.entity = null;
        this.id = null;
        this.data = null;
        this.dataFields = [];
        this.slice = [];
        this.silent = false;
    }

    Message.prototype.setId = function (id) {
        this.id = id;
    };

    Message.prototype.setData = function (key, value) {
        if (!~this.dataFields.indexOf(key)) {
            console.error('Unknown parameter', key);
            console.log('Allowed parameters are', this.params);
            return false;
        }

        if (this.data === null) {
            this.data = {};
        }

        this.data[key] = value;
    };

    Message.prototype.setSlice = function (limit, offset) {
        limit = limit || 1;
        offset = offset || 0;

        this.slice = [limit, offset];
    };

    Message.prototype.setSilent = function (silent) {
        this.silent = !!silent;
    };

    Message.prototype.getEntity = function (message) {
        try {
            message = JSON.parse(message);
        } catch (e) {
            console.log(e);
            return null;
        }

        if (typeof message.entity !== 'string' || typeof exports[message.entity] === 'undefined') {
            console.log('Unknown entity ', message.entity);
            return null;
        }

        var entity = new exports[message.entity];

        if (message.hasOwnProperty('id')) {
            entity.setId(message.id);
        }

        if (message.hasOwnProperty('data')) {

            for (var key in message.data) {
                if (message.data.hasOwnProperty(key)) {
                    entity.setData(key, message.data[key]);
                }
            }
        }

        if (message.hasOwnProperty('slice')) {
            entity.setSlice(message.slice[0], message.slice[1]);
        } else {
            entity.setSlice();
        }

        if (message.hasOwnProperty('silent')) {
            entity.setSilent(message.silent);
        }

        if (entity.data === null && entity.id === null) {
            console.error('Bad message, both id and data are null');
            return null;
        }

        return entity;
    };

    Message.prototype.export = function () {
        var payload = {};

        payload.entity = this.entity;
        payload.id = this.id;
        payload.data = this.data;
        payload.slice = this.slice;

        return JSON.stringify(payload);
    };

    // Specific messages

    // Image
    Image = function () {
        Message.call(this);
        this.entity = 'Image';
        this.dataFields = ['width', 'height', 'content', 'password'];
    };

    Image.prototype = new Message();
    Image.prototype.constructor = Image;


    // Album
    Album = function () {
        Message.call(this);
        this.entity = 'Album';
        this.dataFields = [];
    };

    Album.prototype = new Message();
    Album.prototype.constructor = Album;

    // Setting
    Setting = function () {
        Message.call(this);
        this.entity = 'Setting';
        this.dataFields = [
            'preset', // default by default
            'title',
            'description',
            'allow_download',
            'allow_from_domain'
        ];
    };

    Setting.prototype = new Message();
    Setting.prototype.constructor = Setting;


    // Notification
    Chat = function () {
        Message.call(this);
        this.entity = 'Chat';
        this.dataFields = [
            'content',
            'image',
            'notification'
        ];
    };

    Chat.prototype = new Message();
    Chat.prototype.constructor = Chat;


    // Notification
    Block = function () {
        Message.call(this);
        this.entity = 'Block';
        this.dataFields = [
            ''
        ];
    };

    Chat.prototype = new Message();
    Chat.prototype.constructor = Chat;


    function Socket(url) {
        this.url = url;
        this.ws = null;
        this.queue = [];
        this.messageHandlers = {};
    }

    Socket.prototype.setHandlers = function () {
        var self = this;

        this.ws.onopen = function () {
            return self.open()
        };
        this.ws.onmessage = function (message) {
            return self.message(message)
        };
        this.ws.onclose = function () {
            return self.close()
        };
        this.ws.onerror = function () {
            return self.error()
        };
    };

    Socket.prototype.connect = function () {
        if (!this.url) {
            return false;
        }

        this.ws = new WebSocket(this.url);
        this.setHandlers();
    };

    Socket.prototype.open = function () {
        console.info('Connected');

        for (var i in this.queue) {
            this.send(this.queue[i]);
        }
    };

    Socket.prototype.message = function (e) {
        var message = new sdk.Message();
        var entity = message.getEntity(e.data);

        if (this.messageHandlers[entity.entity]) {
            this.messageHandlers[entity.entity](entity);
        } else {
            console.log('Not handling incoming', entity.entity);
        }
    };

    Socket.prototype.error = function () {
        console.error('Socket error!');
    };

    Socket.prototype.close = function () {
        console.info('Lost connection');
        var self = this;
        setTimeout(function () {
            self.connect(self.url)
        }, this.reconnectInterval);
    };

    Socket.prototype.send = function (message) {
        try {
            this.ws.send(message.export());
            console.log('Sending', message);
            return true;
        } catch (e) {
            this.queue.push(message);
            console.error('Failed to send', message);
            return false;
        }
    };

    Socket.prototype.setHandler = function (messageType, callback) {
        this.messageHandlers[messageType] = callback;
    };

    exports.Socket = Socket;
    exports.Message = Message;

    exports.Image = Image;
    exports.Album = Album;
    exports.Setting = Setting;
    exports.Chat = Chat;



})(typeof exports === 'undefined' ? this['sdk'] = {} : exports);

