import { EventEmitter } from 'events';
import * as originalCommands from 'ioredis/lib/command';
import Promise from 'bluebird';
import * as commands from './commands';
import * as commandsStream from './commands-stream';
import createCommand from './command';
import createData from './data';
import createExpires from './expires';
import Pipeline from './pipeline';

class RedisMock extends EventEmitter {
  constructor({ data = {} } = {}) {
    super();
    this.channels = {};
    this.batch = undefined;

    this.expires = createExpires();

    this.data = createData(this.expires, data);

    Object.keys(commands).forEach(command => {
      this[command] = createCommand(
        commands[command].bind(this),
        command,
        this
      );
    });

    Object.keys(commandsStream).forEach(command => {
      this[command] = commandsStream[command].bind(this);
    });

    process.nextTick(() => {
      this.emit('connect');
      this.emit('ready');
    });
  }
  multi(batch = []) {
    this.batch = new Pipeline(this);
    // eslint-disable-next-line no-underscore-dangle
    this.batch._transactions += 1;

    batch.forEach(([command, ...options]) => this.batch[command](...options));

    return this.batch;
  }
  pipeline() {
    this.batch = new Pipeline(this);
    return this.batch;
  }
  exec(callback) {
    if (!this.batch) {
      return Promise.reject(new Error('ERR EXEC without MULTI'));
    }
    const pipeline = this.batch;
    this.batch = undefined;
    return pipeline.exec(callback);
  }
}
RedisMock.prototype.Command = {
  // eslint-disable-next-line no-underscore-dangle
  transformers: originalCommands._transformer,
  setArgumentTransformer: (name, func) => {
    RedisMock.prototype.Command.transformers.argument[name] = func;
  },

  setReplyTransformer: (name, func) => {
    RedisMock.prototype.Command.transformers.reply[name] = func;
  },
};

module.exports = RedisMock;
