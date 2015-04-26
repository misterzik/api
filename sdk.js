(function (exports) {

    // Message abstraction

    function Message() {
        this.entity = null;
        this.id = null;
        this.data = null;
        this.dataFields = [];
        this.limit = 1;
        this.offset = 0;
        this.silent = false;
        this.action = null;
        this.actions = ['create', 'remove', 'modify'];
        this.channel = null;
    }

    Message.prototype.setAction = function (action) {
        this.action = action;
    };

    Message.prototype.setId = function (id) {
        this.id = id;
    };

    Message.prototype.setChannel = function (channel) {
        this.channel = channel;
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

    Message.prototype.setLimit = function (limit) {
        this.limit = limit;
    };

    Message.prototype.setOffset = function (offset) {
        this.offset = offset;
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

        if (!message.hasOwnProperty('action')) {
            console.error('Action not provided');
            return null;
        }

        entity.setAction(message.action);

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

        if (message.hasOwnProperty('limit')) {
            entity.setLimit(message.limit);
        }

        if (message.hasOwnProperty('offset')) {
            entity.setOffset(message.offset);
        }

        if (message.hasOwnProperty('silent')) {
            entity.setSilent(message.silent);
        }

        if (message.hasOwnProperty('channel')) {
            entity.setChannel(message.channel);
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
        payload.limit = this.limit;
        payload.offset = this.offset;
        payload.action = this.action;
        payload.silent = this.silent;
        payload.channel = this.channel;

        return JSON.stringify(payload);
    };

    Message.prototype.create = function (ws) {
        console.log('Creating not implemented for', this.entity, this);
        return null;
    };
    Message.prototype.modify = function (ws) {
        console.log('Modification not implemented', this.data);
    };
    Message.prototype.remove = function (ws) {
        console.log('Deletion not implemented', this.data);
    };

    Message.prototype.process = function (ws) {
        console.log('Received message', this);
        if (!~this.actions.indexOf(this.action)) {
            console.error('Invalid action', this);
            return false;
        }

        return this[this.action](ws);
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
        this.dataFields = [
            'title',
            'description'
        ];
    };

    Album.prototype = new Message();
    Album.prototype.constructor = Album;

    // Setting
    Setting = function () {
        Message.call(this);
        this.entity = 'Setting';
        this.dataFields = [
            'preset', // default by default
            'allow_download',
            'allow_from_domain'
        ];
    };

    Setting.prototype = new Message();
    Setting.prototype.constructor = Setting;


    // Chat message
    Chat = function () {
        Message.call(this);
        this.entity = 'Chat';
        this.dataFields = [
            'content',
            'image'
        ];
    };

    Chat.prototype = new Message();
    Chat.prototype.constructor = Chat;


    // Notification
    Notice = function () {
        Message.call(this);
        this.entity = 'Notice';
        this.dataFields = [
            'content',
            'type'
        ];
    };

    Notice.prototype = new Message();
    Notice.prototype.constructor = Notice;

    // Notification
    Channel = function () {
        Message.call(this);
        this.entity = 'Channel';
        this.dataFields = ['name'];
    };

    Channel.prototype = new Message();
    Channel.prototype.constructor = Channel;

    exports.Message = Message;
    exports.Image = Image;
    exports.Album = Album;
    exports.Setting = Setting;
    exports.Chat = Chat;
    exports.Notice = Notice;
    exports.Channel = Channel;

})(typeof exports === 'undefined' ? this['sdk'] = {} : exports);
