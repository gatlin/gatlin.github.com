(function(root, factory) {

    if (typeof exports === 'object') {
        module.exports = factory(root);
    } else
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root = factory(root);
    }
}(this, function(Public) {

    /**
     * The structure of this library.
     *
     * Each module is defined as a separate object for namespacing purposes.
     * They are as follows:
     *
     *   Utils - shared, miscellaneous utilities used by each module
     *   Runtime - initializes the runtime for a given Alm instance:
     *     inputs, ports, DOM nodes, etc.
     *   Signal - a signal routes events through the application.
     *   Task - tasks are asynchronous events which may fail.
     *   Port - ports are interfaces through which an Alm application interacts
     *     with the surrounding JavaScript environment, allowing
     *     interoperation with arbitrary JavaScript code.
     *   Graphics - just what it sounds like
     */

    // UTILS

    var Utils = {};

    Utils.make = function(runtime) {

        if (runtime.Utils.values) {
            return runtime.Utils.values;
        }

        var Tuple0 = {
            ctor: '_Tuple0'
        };

        function Tuple2(x,y) {
            return {
                ctor: '_Tuple2',
                _0: x,
                _1: y
            };
        }

        var count = 0;
        function guid(_) {
            return count++;
        }

        return runtime.Utils.values = {
            Tuple0: Tuple0,
            Tuple2: Tuple2,
            guid: guid
        };
    };

    // RUNTIME

    var Runtime = {};

    Public.Display = {
        FULLSCREEN: 0,
        COMPONENT: 1,
        NONE: 2
    };

    Public.fullscreen = function(module, args) {
        var container = document.createElement('div');
        document.body.appendChild(container);
        return Runtime.init(Display.FULLSCREEN, container, module, args || {});
    };

    Public.embed = function(module, container, args) {
        var tag = container.tagName;
        if (tag !== 'DIV') {
            throw new Error("Alm.node must be a DIV");
        }
        return Runtime.init(Display.COMPONENT, container, module, args || {});
    };

    Public.worker = function(module, args) {
        return Runtime.init(Display.NONE, {}, module, args || {});
    };

    Runtime.init =
        function(display, container, module, args, moduleToReplace) {
        var inputs = [];

        var timer = {
            programStart: Date.now(),
            now: function() {
                return Date.now();
            }
        };

        var updateInProgress = false;
        function notify(id,v) {
            if (updateInProgress) {
                throw new Error("Update already in progress!");
            }

            updateInProgress = true;
            var timestep = timer.now();
            for (var i = inputs.length; i--; ) {
                inputs[i].notify(timestep, id, v);
            }
            updateInProgress = false;
        }

        function setTimeout(func, delay) {
            return window.setTimeout(func, delay);
        }

        var listeners = [];
        function addListener(relevantInputs, domNode, eventName, func) {
            domNode.addEventListener(eventName, func);
            var listener = {
                relevantInputs: relevantInputs,
                domNode: domNode,
                eventName: eventName,
                func: func
            };
            listeners.push(listener);
        }

        var argsTracker = {};
        for (var name in args) {
            argsTracker[name] = {
                value: args[name],
                used: false
            };
        }

        var elm = {
            notify: notify,
            setTimeout: setTimeout,
            node: container,
            addListener: addListener,
            inputs: inputs,
            timer: timer,
            argsTracker: argsTracker,
            ports: {},

            isFullscreen: function() { return display === Display.FULLSCREEN; },
            isEmbed: function() { return display === Display.EMBED; },
            isWorker: function() { return display === Display.NONE; }
        };

        function swap(newMdl) {
            Runtime.removeListeners(listeners);
            var div = document.createElement('div');
            var newElm = Runtime.init(display, div, newMdl, args, elm);
            inputs = [];
            return newElm;
        }

        function dispose() {
            Rutime.removeListeners(listeners);
            inputs = [];
        }

        var Module = {};
        try {
            Module = module.make(elm);
            Runtime.checkInputs(elm);
        } catch (error) {
            if (typeof container.appendChild === 'function') {
                container.appendChild(Runtime.errorNode(error.message));
            }
            else {
                console.error(error.message);
            }

            throw error;
        }

        if (display !== Display.NONE) {
            var graphicsNode = Runtime.initGraphics(elm, Module);
        }

        var rootNode = { kids: inputs };
        Runtime.trimDeadNodes(rootNode);
        inputs = rootNode.kids;
        Runtime.filterListeners(inputs, listeners);

        Runtime.addReceivers(elm.ports);

        if (typeof moduleToReplace !== 'undefined') {
            Runtime.hotSwap(moduleToReplace, elm);

            if (typeof graphicsNode !== 'undefined') {
                graphicsNode.notify(0, true, 0);
            }
        }

        return {
            swap: swap,
            ports: elm.ports,
            dispose: dispose
        };
    };

    Runtime.checkInputs = function(elm) {
        var argsTracker = elm.argsTracker;
        for (var name in argsTracker) {
            if (!argsTracker[name].used) {
                throw new Error(
                    "You provided an argument named " + name +
                    " but there is no corresponding port!");
                );
            }
        }
    };

    Runtime.errorNode = function(message) {
        var code = document.createElement('code');
        var lines = message.split('\n');
        code.appendChild(document.createTextNode(lines[0]));
        code.appendChild(document.createElement('br'));
        code.appendChild(document.createElement('br'));
        code.appendChild(document.createTextNode("Actually fuck it."));
        return code;
    };

    Runtime.filterListeners = function(inputs, listeners) {
        loop:
        for (var i = listeners.length; i--; ) {
            var listener = listeners[i];
            for (var j = inputs.length; j--; ) {
                if (listener.relevantInputs.indexOf(inputs[j].id) >= 0) {
                    continue loop;
                }
            }
            listener.domNode.removeEventListener(
                listener.eventName, listener.func);
        }
    };

    Runtime.removeListeners = function(listeners) {
        for (var i = listeners.length; i--; ) {
            var listener = listeners[i];
            listener.domNode.removeEventListener(listener.eventName,listener.func);
        }
    };

    Runtime.addReceivers = function(ports) {
        if ('title' in ports) {
            if (typeof ports.title === 'string') {
                document.title = ports.title;
            }
            else {
                ports.title.subscribe(function(v) {
                    document.title = v;
                });
            }
        }

        if ('redirect' in ports) {
            ports.redirect.subscribe(function(v) {
                if (v.length > 0) {
                    window.location = v;
                }
            });
        }
    };

    Runtime.trimDeadNodes = function(node) {
        if (node.isOutput) {
            return true;
        }

        var liveKids = [];
        for (var i = node.kids.length; i--; ) {
            var kid = node.kids[i];
            if (trimDeadNodes(kid)) {
                liveKids.push(kid);
            }
        }
        node.kids = liveKids;
        return liveKids.length > 0;
    };

    Runtime.initGraphics = function(elm, Module) {
        if (!('main' in module)) {
            throw new Error("Need a 'main' brah");
        }

        var signalGraph = Module.main;

        if (!('notify' in signalGraph)) {
            signalGraph = Signal.make(elm).constant(signalGraph);
        }
        var initialScene = signalGraph.value;

        // Figure out what the render function should be
        var render;
        var update;
        if (initialScene.ctor === 'Element_elm_builtin') {
            var Element = Graphics.Element.make(elm);
            render = Element.render;
            update = Element.updateAndReplace;
        }
        else {
            var VirtualDom = VirtualDom.make(elm);
            render = VirtualDom.render;
            update = VirtualDom.updateAndReplace;
        }

        // Add initial scene to the DOM
        var container = elm.node;
        var node = render(initialScene);
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        container.appendChild(node);

        var _requestAnimationFrame =
            typeof requestAnimationFrame !== 'undefined'
                ? requestAnimationFrame
                : function (cb) { Runtime.setTimeout(cb, 1000 / 60); };

        var NO_REQUEST = 0;
        var PENDING_REQUEST = 1;
        var EXTRA_REQUEST = 2;
        var state = NO_REQUEST;
        var savedScene = initialScene;
        var scheduledScene = initialScene;

        function domUpdate(newScene) {
            scheduledScene = newScen;

            switch(state) {
                case NO_REQUEST:
                    _requestAnimationFrame(drawCallback);
                    state = PENDING_REQUEST;
                    return;
                case PENDING_REQUEST:
                    state = PENDING_REQUEST;
                    return;
                case EXTRA_REQUEST:
                    state = PENDING_REQUEST;
                    return;
            };
        }

        function drawCallback() {
            switch(state) {
                case NO_REQUEST:
                    throw new Error(
                        "Unexpected draw callback"
                    );

                case PENDING_REQUEST:
                    _requestAnimationFrame(drawCallback);
                    state = EXTRA_REQUEST;

                    draw();
                    return;

                case EXTRA_REQUEST:
                    state = NO_REQUEST;
                    return;
            };
        }

        function draw() {
            update(elm.node.firstChild, savedScene, scheduledScene);
            Window.values.resizeIfNeeded();
            savedScene = scheduledScene;
        }

        var renderer = Signal.make(elm).output('main', domUpdate, signalGraph);
        Window.values.resizeIfNeeded();

        return renderer;
    };

    Runtime.hotSwap = function(from,to) {
        function similar(nodeOld, nodeNew) {
            if (nodeOld.id != nodeNew.id) {
                return false;
            }
            if (nodeOld.isOutput) {
                return nodeNew.isOutput;
            }
            return nodeOld.kids.length === nodeNew.kids.length;
        }

        function swap(nodeOld, nodeNew) {
            nodeNew.value = nodeOld.value;
            return true;
        }
        var canSwap = Runtime.depthFirstTraversals(similar, from.inputs, to.inputs);
        if (canSwap) {
            Runtime.depthFirstTraversals(swap, from.inputs, to.inputs);
        }
        from.node.parentNode.replaceChild(to.node, from.node);
        return canSwap;
    };

    Runtime.depthFirstTraversals = function(f, queueOld, queueNew) {
        if (queueOld.length !== queueNew.length) {
            return false;
        }
        queueOld = queueOld.slice(0);
        queueNew = queueNew.slice(0);

        var seen = [];
        while (queueOld.length > 0 && queueNew.length > 0) {
            var nodeold = queueOld.pop();
            var nodeNew = queueNew.pop();
            if (seen.indexOf(nodeOld.id) < 0) {

                if (!f(nodeOld, nodeNew)) {
                    return false;
                }
                queueOld = queueOld.concat(nodeOld.kids || [])
                queueNew = queueNew.concat(nodeNew.kids || [])
                seen.push(nodeOld.id);
            }
        }
        return true;
    };

    var F2 = Public.F2 = function(fn) {
        function wrapper(a) {
            return function(b) {
                return fn(a,b);
            };
        }
        return wrapper;
    };

    var F3 = Public.F3 = function(fn) {
        function wrapper(a) {
            return function(b) {
                return function(c) {
                    return fn(a,b,c);
                };
            };
        }
        return wrapper;
    };

    var A2 = Public.A2 = function(fn, a, b) {
        return fn.arity === 2
            ? fn.func(a,b)
            : fn(a)(b);
    };

    // Signal

    var Signal = {};
    Signal.make = funtion(runtime) {
        var Utils = Utils.make(runtime);
        var Task = Task.make(runtime);

        function broadcastToKids(node, timestamp, update) {
            var kids = node.kids;
            for (var i = kids.length; i--; ) {
                kids[i].notify(timestamp, update, node.id);
            }
        }

        // input signals

        function input(name, base) {
            var node = {
                id: Utils.guid(),
                name: 'input-' + name,
                value: base,
                parents: [],
                kids: []
            };

            node.notify = function(timestamp, targetId, value) {
                var update = targetId === node.id;
                if (update) {
                    node.value = value;
                }
                broadcastToKids(node, timestamp, update);
            };

            runtime.inputs.push(node);
            return node;
        }

        function constant(value) {
            return input('constant', value);
        }

        // mailboxes

        function mailbox(base) {
            var signal = input('mailbox', base);

            function send(value) {
                return Task.asyncFunction(function(cb) {
                    runtime.setTimeout(funtion() {
                        runtime.notify(signal.id, value);
                    },0);
                    cb(Task.succeed(Utils.Tuple0));
                });
            }

            return {
                signal: signal,
                address: {
                    ctor: 'Address',
                    _0: send
                }
            };
        }

        function sendMessage(message) {
            Task.perform(message._0);
        }

        // output signals

        function output(name, handler, parent) {
            var node = {
                id: Utils.guid(),
                name: 'output-' + name,
                parents: [parent],
                isOutput: true
            };

            node.notify = function(timestamp, parentUpdate, parentId) {
                if (parentUpdate) {
                    handler(parent.value);
                }
            };

            parent.kids.push(node);
            return node;
        }

        function mapMany(refreshValue, args) {
            var node = {
                id: Utils.guid(),
                name: 'map' + args.length,
                value: refreshValue(),
                parents: args,
                kids: []
            };

            var numberOfParents = args.length;
            var count = 0;
            var update = false;

            node.notify = function(timestamp, parentUpdate, parentId) {
                ++count;
                update = update || parentUpdate;
                if (count === numberOfParents) {
                    if (update) {
                        node.value = refreshValue();
                    }
                    broadcastToKids(node, timestamp, update);
                    update = false;
                    count = 0;
                }
            };

            for (var i = numberOfParents; i--; ) {
                args[i].kids.push(node);
            }

            return node;
        }

        function map(fn, a) {
            function refreshValue() {
                return fn(a.value);
            }
            return mapMany(refreshValue, [a]);
        }

        // foldp - a stateful fold
        function foldp(update, state, signal) {
            var node = {
                id: Utils.guid(),
                name: 'foldp',
                parents: [signal],
                kids: [],
                value: state
            };

            node.notify = function(timestamp, parentUpdate, parentId) {
                if (parentUpdate) {
                    node.value = A2(update, signal.value, node.value);
                }
                broadcastToKids(node, timestamp, parentUpdate);
            };
            signal.kids.push(node);
            return node;
        }

        function timestamp(signal) {
            var node = {
                id: Utils.guid(),
                name: 'timestamp',
                value: Utils.Tuple2(runtime.timer.programStart, signal.value),
                parents: [signal],
                kids: []
            };

            node.notify = function(timestamp, parentUpdate, parentId) {
                if (parentUpdate) {
                    node.value = Utils.Tuple2(timestamp, signal.value);
                }
                broadcastToKids(node, timestamp, parentUpdate);
            };

            signal.kids.push(node);
            return node;
        }

        function delay(time, signal) {
            var delayed = input('delay-input-'+time, signal.value);
            function handler(value) {
                runtime.setTimeout(function() {
                    runtime.notify(delayed.id, value);
                }, time);
            }
            output('delay-output-'+time, handler, signal);
            return delayed;
        }

        return runtime.Signal.values = {
            input: input,
            constant: constant,
            mailbox: mailbox,
            sendMessage: sendMessage,
            output: output,
            map: F2(map),
            foldp: F3(foldp),
            //genericMerge
            //filterMap
            //sampleOn
            //dropRepeats
            timestamp: timestamp,
            delay: F2(delay)
        };

    }; // Signal.make

    // Task
    var Task = {};

    Task.make = function(runtime) {
        if (runtime.Task.values) {
            return runtime.Task.values;
        }

        var Utils = Utils.make(runtime);
        var Signal;
        var Result = Result.make(runtime);

        function succeed(value) {
            return {
                tag: 'Succeed',
                value: value
            };
        }

        function fail(error) {
            return {
                tag: 'Fail',
                value: error
            };
        }

        function asyncFunction(fn) {
            return {
                tag: 'Async',
                asyncFunction: fn
            };
        }

        function andThen(task, cb) {
            return {
                tag: 'AndThen',
                task: task,
                callback: cb
            };
        }

        function catch_(task, cb) {
            return {
                tag: 'Catch',
                task: task,
                callback: cb
            };
        }

        function perform(task) {
            runTask({ task: task }, function() {});
        }

        function performSignal(name, signal) {
            var workQueue = [];

            function onComplete() {
                workQueue.shift();

                if (workQueue.length > 0) {
                    var task = workQueue[0];
                    runtime.setTimeout(function() {
                        runTask(task, onComplete);
                    }, 0);
                }
            }

            function register(task) {
                var root = { task: task };
                workQueue.push(root);
                if (workQueue.length === 1) {
                    runTask(root, onComplete);
                }
            }

            if (!Signal) {
                Signal = Signal.make(runtime);
            }

            Signal.output('perform-tasks-'+name, register, signal);
            register(signal.value);
            return signal;
        }

        function mark(status, task) {
            return { status: status, task: task };
        }

        function runTask(root, onComplete) {
            var result = mark('runnable', root.task);
            while (result.status === 'runnable') {
                result = stepTask(onComplete, root, result.task);
            }

            if (result.status === 'done') {
                root.task = result.task;
                onComplete();
            }

            if (result.status === 'blocked') {
                root.task = result.task;
            }

        }

        function stepTask(onComplete, root, task) {
            var tag = task.tag;

            if (tag === 'Succeed' || tag === 'Fail') {
                return mark('done', task);
            }

            if (tag === 'Async') {
                var placeHolder = {};
                var couldBeSync = true;
                var wasSync = false;

                task.asyncFunction(function(result) {
                    placeHolder.tag = result.tag;
                    placeHolder.value = result.value;
                    if (couldBesync) {
                        wasSync = true;
                    }
                    else {
                        runTask(root, onComplete);
                    }
                });

                couldBeSync = false;
                return mark(wasSync ? 'done' : 'blocked', placeHolder);
            }

            if (tag === 'Andthen' || tag === 'Catch') {
                var result = mark('runnable', task.task);
                while (result.status === 'runnable') {
                    result = stepTask(onComplete, root, result.task);
                }

                if (result.status === 'done') {
                    var activeTask = result.task;
                    var activeTag = activeTask.tag;
                    var succeedChain =
                        activeTag === 'Succeed' && tag === 'AndThen';
                    var failChain =
                        activeTag === 'Fail' && tag === 'Catch';

                    return (succeedChain || failChain)
                        ? mark('runnable', task.callback(activeTask.value))
                        : mark('runnable', activeTask);
                }

                if (result.status === 'blocked') {
                    return mark('blocked', {
                        tag: tag,
                        task: result.task,
                        callback: task.callback
                    });
                }
            }
        }

        function sleep(time) {
            return asyncFunction(function(cb) {
                runtime.setTimeout(function() {
                    cb(succeed(Utils.Tuple0));
                }, time);
            });
        }

        function spawn(task) {
            return asyncFunction(function(cb) {
                var id = runtime.setTimeout(function() {
                    perform(task);
                }, 0);
                cb(succeed(id));
            });
        }

        return runtime.Task.values = {
            succeed: succeed,
            fail: fail,
            asyncFunction: asyncFunction,
            andThen: F2(andThen),
            catch_: F2(catch_),
            perform: perform,
            performSignal: performSignal,
            spawn: spawn,
            sleep: sleep
        };
    };

    // Ports
    var Port = {};
    Port.make = function(runtime) {
        if (runtime.Port.values) {
            return runtime.Port.values;
        }

        var NS;

        // inbound ports
        function inbound(name, type, converter) {
            if (!runtime.argsTracker[name]) {
                throw new Error(
                    "No argument given for port ("+name+")."
                );
            }
            var arg = runtime.argsTracker[name];
            arg.used = true;
            return jsToElm(name, type, converter, arg.value);
        }

        function inboundSignal(name, type, converter) {
            var initialValue = inbound(name, type, converter);
            if (!NS) {
                NS = Signal.make(runtime);
            }

            var signal = NS.input('inbound-port-'+name, initialValue);

            function send(jsValue) {
                var elmValue = jsToElm(name, type, converter, jsValue);
                runtime.setTimeout(function() {
                    runtime.notify(signal.id, elmValue);
                }, 0);
            }

            runtime.ports[name] = { send: send };
            return signal;
        }

        function jsToElm(name, type, converter, value) {
            try {
                return converter(value);
            } catch (e) {
                throw new Error(e.message);
            }
        }

        // outbound ports
        function outbound(name, converter, elmValue) {
            runtime.ports[name] = converter(elmValue);
        }

        function outboundSignal(name, converter, signal) {
            var subscribers = [];
            function subscribe(handler) {
                subscribers.push(handler);
            }
            function unsubscribe(handler) {
                subscribers.pop(subscribers.indexOf(handler));
            }

            function notify(elmValue) {
                var jsValue = converter(elmValue);
                var len = subscribers.length;
                for (var i = 0; i < len; ++i) {
                    subscribers[i](jsValue);
                }
            }

            if (!NS) {
                NS = Signal.make(runtime);
            }
            NS.output('outbound-port-'+name, notify, signal);

            runtime.ports[name] = {
                subscribe: subscribe,
                unsubscribe: unsubscribe
            };

            return signal;
        }

        return runtime.Port.values = {
            inbound: inbound,
            outbound: outbound,
            inboundSignal: inboundSignal,
            outboundSignal: outboundSignal
        };
    };


    return Public;
}));
