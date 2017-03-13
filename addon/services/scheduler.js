import Ember from 'ember';

class Token {
  constructor() {
    this._cancelled = false;
  }

  get cancelled() {
    return this._cancelled;
  }

  cancel() {
    this._cancelled = true;
  }
}

class Queue {
  constructor(queueName) {
    this.queueName = queueName;
    this.reset();
  }

  reset() {
    this.tasks = [];
    this.isActive = false;
  }
}

export default Ember.Service.extend({
  queueNames: ['afterRoutePaint'],

  init() {
    this._super(...arguments);
    this._nextPaintFrame = null;
    this._nextPaintTimeout = null;
    this._nextAfterPaintPromise = null;
    this._initQueues();
    this._connectToRouter();
  },

  scheduleWork(queueName, callback) {
    const queue = this.queues[queueName];
    if (!queue.isActive) {
      const token = new Token();
      queue.tasks.push(callback);
      queue.tasks.push(token);
      return token;
    } else {
      callback();
    }
  },

  cancelWork(token) {
    token.cancel();
  },

  flushQueue(queueName) {
    const queue = this.queues[queueName];
    queue.isActive = false;
    for (let i = 0; i < queue.tasks.length; i += 2) {
      const callback = queue.tasks[i];
      const token = queue.tasks[i+1];

      if (!token.cancelled) {
        callback();
      }
    }
  },

  _initQueues() {
    const queues = this.queues = Object.create(null);
    const queueNames = this.queueNames;

    for (let i = 0; i < queueNames.length; i++) {
      queues[queueNames[i]] = new Queue();
    }
  },

  _resetQueues() {
    const queues = this.queues;
    const queueNames = this.queueNames;

    for (let i = 0; i < queueNames.length; i++) {
      queues[queueNames[i]].reset();
    }
  },

  _afterNextPaint() {
    if (this._nextAfterPaintPromise) {
      return this._nextAfterPaintPromise;
    }

    this._nextAfterPaintPromise = new Ember.RSVP.Promise((resolve) => {
      this._nextPaintFrame = requestAnimationFrame(() => {
        this._nextPaintTimeout = Ember.run.later(() => {
          this._nextAfterPaintPromise = null;
          this._nextPaintFrame = null;
          this._nextPaintTimeout = null;
          resolve();
        }, 0);
      });
    });

    return this._nextAfterPaintPromise;
  },

  // TODO on destroy this should be disconnected I think
  _connectToRouter() {
    const router = this.get('router');

    router.on('willTransition', () => {
      this._resetQueues();
    });

    router.on('didTransition', () => {
      this._afterNextPaint()
        .then(() => {
          this.flushQueue('afterRoutePaint');
        });
    });
  },
});
