(function(Public) {
/**
 * Alm.js
 *
 * A simple re-implementation of the Elm runtime and core libraries, using
 * loeb.js.
 */

var guid_count = 0;
var guid = Public.guid = function() {
    return guid_count++;
};

/**
 * Signal
 *
 * Event-routing mechanism for the application. A signal is fundamentally a
 * function to transform upstream values and an array of downstream receiving
 * signals.
 *
 * With one exception, signals are stateless: they receive a value, transform
 * it, and broadcast to receivers (if applicable).
 */

// perhaps I should just store a value and let methods handle transformations?
function Signal(fn, receivers) {
    this.id = guid();
    this.fn = fn;
    this.receivers = (typeof receivers !== 'undefined')
        ? receivers
        : [];
}

// A signal which just repeats what it has been given.
Signal.make = function() {
    return new Signal(id, []);
};

Signal.constant = function(x) {
    return new Signal(constant(x));
};

Signal.output = function(handler) {
    return new Signal(function(v) {
        handler(v);
    }, []);
};

Signal.prototype = {
    send: function(timestamp, inputId, value) {
        var result = this.fn(value);
        if (result === undefined) { return; }
        if (this.isOutput) { return; }
        for (var i = this.receivers.length; i--; ) {
            this.receivers[i].send(timestamp, this.id, result);
        }
    },
    connect: function(receiver) {
        this.receivers.push(receiver);
        return this;
    },
    addReceivers: function(receivers) {
        this.receivers.concat(receivers);
    },
    receive: function(upstream) {
        upstream.receivers.push(this);
        return this;
    },
    // signal transformers
    filter: function(cond) {
        var sig = this;
        var r = new Signal(function(v) {
            var result = sig.fn(v);
            if (cond(result)) {
                return result;
            }
        });
        this.connect(r);
        return r;
    },
    reduce: function(initial, reducer) {
        var sig = this;
        var state = initial;
        var r = new Signal(function(v) {
            state = reducer(sig.fn(v), state);
            return state;
        });
        this.connect(r);
        return r;
    },
    map: function(f) {
        var sig = this;
        var r = new Signal(function(v) {
            return f(sig.fn(v));
        });
        this.connect(r);
        return r;
    },
    recv: function(f) {
        var s = new Signal.output(f);
        this.connect(s);
        return s;
    }
};

Public.Signal = {
    make: Signal.make,
    output: Signal.output,
    constant: Signal.constant,
};

/**
 * Mailboxes
 *
 * A mailbox is basically a named signal which a client application may update
 * Updates happen asynchronously so they're a good choice for propagating UI
 * updates.
 *
 * Mailboxes don't contain state, they just send a default value immediately
 * after being created.
 *
 * This function is intended to be called by an initialized `App` object, which
 * will then expose the inner function for client applications to make
 * mailboxes.
 */
function mailbox(runtime) {
    return function (base) {
        var signal = Signal.make();
        runtime.inputs.push(signal);
        var mb = {
            signal: signal,
            send: function(v) {
                runtime.async(function() {
                    runtime.notify(signal.id, v);
                });
            }
        };
        mb.send(base);
        return mb;
    };
}

/**
 * App
 *
 * Encapsulates the application state and exports an interface with which it's
 * difficult to screw up too much.
 */

function App(start) {
    this.start = start;
}

Public.App = App;

App.of = function(v) {
    var value = (typeof v !== 'undefined')
        ? v
        : null;
    return new App(function(runtime) {
        return {
            value: value,
            runtime: runtime
        };
    });
};

function runtime() {
    return new App(function(runtime) {
        return {
            value: runtime,
            runtime: runtime
        };
    });
}

function save(newruntime) {
    return new App(function(runtime) {
        return {
            value: undefined,
            runtime: newruntime
        };
    });
}

Public.save = save;

function modify(f) {
    return runtime().then(function(runtime) {
        var newruntime = f(runtime);
        return save(newruntime);
    });
}

// Initalize the application runtime
App.init = function(root) {
    var dom = (typeof root !== 'undefined')
        ? document.getElementById(root)
        : document;
    var listeners = [];
    var inputs = [];
    var updating = false;
    var timer = {
        programStart: Date.now(),
        now: function() { return Date.now(); }
    };

    function setTimeout(fn,delay) {
        return window.setTimeout(fn,delay);
    }

    function async(fn) {
        return window.setTimeout(fn,0);
    }

    function addListener(whichInputs, dom, evtName, fn) {
        dom.addEventListener(evtName, fn);
        var listener = {
            whichInputs: inputs,
            dom: dom,
            evtName: evtName,
            fn: fn
        };
        listeners.push(listener);
    }

    function notify (inputId, v) {
        var timestamp = timer.now();
        for (var i = inputs.length; i--; ) {
            var inp = inputs[i];
            if (inp.id === inputId) {
                inp.send(timestamp, inputId, v);
            }
        }
    }

    // Elementary signals have names you can use
    var events = { };

    var runtime = {
        dom: dom,
        timer: timer,
        inputs: inputs,
        addListener: addListener,
        notify: notify,
        setTimeout: setTimeout,
        events: events,
        async: async,
    };

    setupEvents(runtime);

    // Setup runtime utilities
    runtime.utils = {
        mailbox: mailbox(runtime),
        byId: function(_id) {
            return document.getElementById(_id);
        }
    };

    return save(runtime);
};

App.prototype = {
    map: function(f) {
        var me = this;
        return new App(function(runtime) {
            var prev = me.start(runtime);
            return {
                value: f(prev.value),
                runtime: prev.runtime
            };
        });
    },
    flatten: function() {
        var me = this;
        return new App(function(runtime) {
            var prev = me.start(runtime);
            var inner = prev.value.start(prev.runtime);
            return inner;
        });
    },
    evalApp: function(initruntime) {
        var result = this.start(initruntime);
        return result.value;
    },
    execApp: function(initruntime) {
        var result = this.start(initruntime);
        return result.runtime;
    },
    runtime: function(k) {
        return this.then(function(_) {
            return new App(function(runtime) {
                return {
                    value: runtime,
                    runtime: runtime
                };
            });
        })
        .then(k);
    },
    main: function(k) {
        return this.runtime(function(runtime) {
            return App.of(k(runtime.events,runtime.dom, runtime.utils));
        });
    },
};

instance(App,Functor);
instance(App,Monad);

// Setup events for the core browser events
function setupEvents(runtime) {
    var events = {
        mouse: {
            click: Signal.make(),
            dblclick: Signal.make()
        },
        keyboard: {
            keypress: Signal.make(),
            keydown: Signal.make(),
            keyup: Signal.make(),
            blur: Signal.make()
        },
        input: Signal.make(),
        change: Signal.make()
    };

    function setupEvent(evtName, sig) {
        runtime.inputs.push(sig);
        runtime.addListener([sig], runtime.dom, evtName, function(evt) {
            runtime.notify(sig.id, evt);
        });
    }

    setupEvent('click', events.mouse.click);
    setupEvent('dblclick', events.mouse.dblclick);
    setupEvent('keypress', events.keyboard.keypress);
    setupEvent('keydown', events.keyboard.keydown);
    setupEvent('keyup', events.keyboard.keyup);
    setupEvent('blur', events.keyboard.blur);
    setupEvent('input', events.input);
    setupEvent('change', events.change);

    runtime.events = events;
}

return Public;
})(this);
