/**
 * A task is some text and an id. It may be completed or not. It may currently
 * edited or not as well.
 */
function new_task(description, id) {
    return {
        description: description,
        completed: false,
        editing: false,
        uid: id
    };
}

/**
 * Our application model is a list of tasks, a uid for numbering tasks, and a
 * main text field containing what the user has typed.
 */
function empty_model() {
    return {
        tasks: [],
        field: "",
        uid: 0
    };
}

/**
 * Poor man's enum. These are the types of actions we will be performing on the
 * model.
 */
var Actions = {
    NoOp: 0,
    Add: 1,
    UpdateField: 2,
    Delete: 3,
    Complete: 4,
    Editing: 5,
    UpdateTask: 6
};

/**
 * How to deal with updates to our model.
 *
 * The first argument is an action type (and possibly some relevant data);
 * the second argument is our current model to update and return.
 *
 */
function update(action, model) {

    switch (action.type) {

        case Actions.UpdateField:
            model.field = action.content;
            return model;

        case Actions.Add:
            if (model.field !== "") {
                model.tasks.push(new_task(model.field, model.uid));
                model.uid = model.uid + 1;
                model.field = "";
            }
            return model;

        case Actions.Delete:
            var uid = action.content;
            var idx = -1;
            for (var i = 0; i < model.tasks.length; i++) {
                if (model.tasks[i].uid === uid) {
                    idx = i;
                    break;
                }
            }
            if (idx > -1) {
                model.tasks.splice(idx, 1);
            }
            return model;

        case Actions.Complete:
            var uid = action.content;
            for (var i = model.tasks.length; i--; ) {
                if (model.tasks[i].uid === uid) {
                    model.tasks[i].completed = !model.tasks[i].completed;
                    break;
                }
            }
            return model;

        case Actions.Editing:
            var uid = action.content;
            for (var i = model.tasks.length; i--; ) {
                if (model.tasks[i].uid === uid) {
                    model.tasks[i].editing = true;
                    break;
                }
            }
            return model;

        // Editing is finished
        case Actions.UpdateTask:
            var uid = action.content.uid;
            for (var i = model.tasks.length; i--; ) {
                if (model.tasks[i].uid === uid) {
                    model.tasks[i].editing = false;
                    model.tasks[i].description = action.content.text;
                    break;
                }
            }
            return model;
    }

    return model;
}

/**
 * Render the model
 *
 * TODO This is ugly and I know it. I plan on adding a virtual DOM facility
 * where virtual elements listen to mailboxes and update themselves
 * accordingly. Stay tuned.
 */
function render_list(el, model) {
    if (el.firstChild) {
        el.removeChild(el.firstChild);
    }
    document.getElementById('field').value = model.field;
    var ul = document.createElement('ul');
    ul.className = 'todo_list';
    for (var i = 0; i < model.tasks.length; i++) {
        // The list item
        var task = model.tasks[i];
        var li = document.createElement('li');
        li.id = 'task-'+task.uid;
        li.className = 'task';

        // Checkbox to indicate task completion
        var checkbox = document.createElement('input');
        checkbox.className = 'toggle';
        checkbox.type = 'checkbox';
        checkbox.id = 'check-task-'+task.uid;
        if (task.completed) {
            checkbox.checked = 'checked';
        }
        checkbox.value = 1;

        // The content of the task
        var desc;
        if (task.editing) {
            desc = document.createElement('input');
            desc.type = 'text';
            desc.id = 'edit-task-'+task.uid;
            desc.className = 'editing';
            desc.value = task.description;
        }
        if (!task.editing) {
            desc = document.createElement('label');
            desc.innerHTML = task.description;
            desc.className = 'task_text';
            desc.id = 'text-task-'+task.uid;
            if (task.completed) {
                desc.className = 'completed';
            }
        }

        // A delete button
        var del_btn = document.createElement('button');
        del_btn.id = 'del-task-'+task.uid;
        del_btn.className = 'delete_button';

        li.appendChild(checkbox);
        li.appendChild(desc);
        li.appendChild(del_btn);
        ul.appendChild(li);
    }
    el.appendChild(ul);
}

// Set up the application runtime state
var app = App.init('the_app')

// for shits let's extend the application runtime!
.runtime(function(runtime) {
    runtime.utils.storage = window.localStorage;
    return put(runtime);
})

// Now we wire our signals together
.main(function(events, dom, utils) {

    // When an event happens, an action is sent here.
    var actions = utils.mailbox({
        type: Actions.NoOp
    });

    // Do we have a saved model? If so, use it. Otherwise create an empty one.
    var starting_model = (utils.storage.getItem('todos') === null)
        ? empty_model()
        : JSON.parse(utils.storage.getItem('todos'));

    // a signal broadcasting updated models
    var model = actions.signal
        .reduce(starting_model, update);

    // a model listener - renders the model
    var render = model.recv(function(model) {
        var wrapper = utils.byId('wrapper');
        render_list(wrapper, model);
    });

    // a model listener - saves the model
    var save = model.recv(function(model) {
        utils.storage.setItem('todos',JSON.stringify(model));
    });

    // Fires when the 'enter' key is pressed
    var onEnter = events.keyboard.keydown
        .filter(function(evt) { return evt.keyCode === 13; });

    // When enter is pressed inside the main input field, add a task
    onEnter
        .filter(function(evt) { return evt.target.id === 'field'; })
        .recv(function(evt) {
            actions.send({ type: Actions.Add });
        });

    // When enter is pressed inside a task edit field, finish updating the task
    onEnter
        .filter(function(evt) { return evt.target.className === 'editing'; })
        .recv(function(evt) {
            actions.send({
                type: Actions.UpdateTask,
                content: {
                    uid: parseInt(evt.target.id.split('-')[2]),
                    text: evt.target.value
                }
            });
        });

    // Whenever the text box is updated, update the model 'field'
    events.input
        .filter(function(evt) { return evt.target.id === 'field'; })
        .recv(function(evt) {
            actions.send({
                type: Actions.UpdateField,
                content: evt.target.value
            });
        });

    // Was a delete button clicked?
    events.mouse.click
        .filter(function(evt) {
            return evt.target.className === 'delete_button';
        })
        .recv(function(evt) {
            actions.send({
                type: Actions.Delete,
                content: parseInt(evt.target.id.split('-')[2])
            });
        });

    events.change
        .filter(function(evt) {
            return evt.target.className === 'toggle';
        })
        .recv(function(evt) {
            actions.send({
                type: Actions.Complete,
                content: parseInt(evt.target.id.split('-')[2])
            });
        });

    events.mouse.dblclick
        .filter(function(evt) {
            return evt.target.className === 'task_text'; })
        .recv(function(evt) {
            actions.send({
                type: Actions.Editing,
                content: parseInt(evt.target.id.split('-')[2])
            });
        });

    actions.send({
        type: Actions.Load,
        content: utils.storage.getItem('todos')
    });
})

// and begin the application
.start();

