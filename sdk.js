(function (exports) {

    // Message abstraction

    function Message() {
        this.entity = null;
        this.id = null;
        this.data = null;
        this.slice = [];
        this.silent = false;
        this.dataFields = [];
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

    Message.prototype.send = function (ws) {

        var message = {
            entity: this.entity,
            id: this.id,
            data: this.data,
            slice: this.slice
        };

        console.log('Sending', message);

        ws.send(JSON.stringify(message));
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


    // Specific messages

    Image = function () {
        Message.call(this);
        this.entity = 'Image';
        this.dataFields = ['width', 'height', 'content', 'password'];
    };

    Image.prototype = new Message();
    Image.prototype.constructor = Image;


    exports.Image = Image;
    exports.Message = Message;

})(typeof exports === 'undefined' ? this['sdk'] = {} : exports);

