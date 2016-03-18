/*
 * Application configuration and state are managed inside of an `App` object.
 */

// Set up the application runtime state
var app = App.init('the_app')

// write your application!
.main(function(events, utils) {
    var clicks = utils.mailbox(0);
    var lastKey = utils.mailbox('none');

    /* A signal handling pipeline
     *
     * Only events originating from within the element with the id given to
     * `init` ('the_app' in this case) will be visible from within the
     * application.
     */
    events.mouse.click

        // Filter out events we don't care about
        .filter(function(evt) {
            return (evt.target.id === 'btn1'
                 || evt.target.id === 'btn2');
        })

        // Either increase the total count or reset it
        .reduce(0, function(which, count) {
            if (which.target.id === 'btn2') {
                return 0;
            }
            return count + 1;
        })

        // and send the value to a mailbox
        .recv(function(v) {
            clicks.send(v);
        });

    events.keyboard.keypress
        .map(function(evt) {
            console.log(evt);
            return evt.key;
        })
        .recv(function(key) {
            utils.byId('key_pressed').innerHTML = key;
        })

    /* Update the view based on the mailbox */
    clicks.signal.recv(function(n) {
        utils.byId('num_clicks').innerHTML = n;
    });

    lastKey.signal.recv(function(keyCode) {
        utils.byId('key_pressed').innerHTML = keyCode;
    });

})

// and begin the application
.start();

