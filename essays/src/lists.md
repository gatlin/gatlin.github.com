---
title: Everything you always wanted to know about lists, but were afraid to ask
lead: Or, how we are ultimately defined by our self-destruction
...

If you just want the code from this essay, it's pretty short and [available
as a gist][thecode].

Last time, on Gatlin's Boring Essays ...
===

This essay is the followup to a [previous essay on Church numerals and lambda
calculus][church]. If you aren't a little familiar with those topics or just
want to know where this essay is picking up I personally wouldn't mind if you
went and read it first.

Go ahead; I'll wait. :)

Lists
===

Lists, or something like them, exist in almost every programming language. They
are useful and model a lot of problems very well.

Reading from or writing to a file? You're dealing with lists of bytes.

Doing some accounting? A ledger is a list of rows.

Etc.

A program consisting of a number of loops over data can be turned inside out
into a series of transformations to a list.

So I don't know about you but I was shocked when in the last essay toward the
end we stumbled across these three functions[^1]:

```javascript
let nil  = (h) => (t) => n;
let cons = (h) => (t) => (c) => (n) => h(x)(t(c)(n));
let foldr = (list) => (f) => (x) => list(f)(x);
```

When we use these together we can build simple linked lists ...

```javascript
let list_1 = cons(1) (cons(2) (cons(3) (nil)));
```

... and then process them. For example, we can define a function `sum` to sum
the numbers in a list:

```javascript
let sum = (xs) => foldr(xs)( (a) => (b) => a + b )(0);
let six = sum(list_1); // -> 6
```

The purpose of this essay is to explore how lists work, what we can do
practically with them, and how thinking in terms of lists makes short work of a
large number of problems.

Fold it right there
===

A *fold* is a reduction or aggregation of the values in a data structure into
one final result. You start on one end with an initial value `x` and a function
`f` and proceed to process each value `v` in the list in turn by evaluating
`f(v,x)`, which you then use as the next `x`. When you run out of values in
the structure you return `x`.

Because there's no great way to describe that without inducing sleep, here is
an illustration of the `sum` function from above:

    Remaining list      Current result
    --------------      --------------
    [ 1 2 3 ]           0
          ^---------- + 3
                      ---
    [ 1 2 ]             3
        ^------------ + 2
                      ---
    [ 1 ]               5
      ^-------------- + 1
                      ---
    []                  6

There are two kinds of folds for lists: *left* and *right* folds. On the
surface the only difference is if you start at the beginning (the "left") or
the end (the "right") of the list. We'll come back to this.

So that's what a fold is in the abstract, but how do those three functions lead
to this?

Let's take another look at `cons`. We saw that `cons` is a slightly modified
version of `incr`, which takes a Church numeral and adds 1 to it. Here they are
side by side:

```javascript
let incr =        (n) => (f) => (x) => f   (n(f)(x));
let cons = (h) => (t) => (f) => (x) => h(x)(t(f)(x));
```

And Church numeral 0 and `nil` are identical:

```javascript
let _0  = (f) => (x) => x;
let nil = (h) => (t) => t;
```

I'm using `h` to mean *head* of the list, and `t` to mean the *tail* of the
list. That's intended to reflect how these lists work: a list is either an
empty starting point, or a *head* linked to a remaining *tail* list.

Just as Church numerals represent a number by applying `f` to `x` a certain
number of times, a list is a function whose `f` takes *two* arguments, not just
one.

Otherwise, they work the same: a list of length *l* essentially waits for a
function and a value and applies the function *l* times to the value, along
with whatever the contents of the list are.

Wait. Wait that's what folds are.

Wait.

*Lists* ARE *folds???*

Yes
===

A list is, essentially, a blueprint for how to destroy it. It's a series of
repeated applications of some two-argument function to successive items of the
list on the left side, and a continually-changing intermediate result on the
right side.

The idea of Church numerals extended to more complex data structures is called
a *Church encoding*. They're curious because not only do they lend insight into
the nature of and relationships between different structures, but also because
they can be efficient, too, if you use them correctly.[^2]

These lists are essentially loops turned inside out, waiting for their bodies.

Now LIST-en up
===

The following are common list-processing utilities you'd find in other
programming languages, implemented for our list representation with example
usages.

The key thing to note here is that they may *all* be described by `foldr`.
`foldr` is what defines a list. We are defined by how we are destroyed.

Length of a list
---

```javascript
let length = (xs) => foldr(xs)((a) => (b) => b + 1)(0);
```

You don't care *what* the list values are, you just want to add 1 to 0 for each
item in the list.

Mapping
---

```javascript
let map = (f) => (xs) => foldr(xs)( (y) => (ys) => cons(f(y))(ys) )(nil);

let isEven = (n) => n % 2 === 0;
let result = map (isEven) (list_1);
//  -> cons (false) (cons (true) (cons (false) (nil)))
```

You have function `f` which turns values into other values. So, starting with
an empty list, you apply `f` to each value and then `cons` it to the result.

Filtering
---

```javascript
let filter = (cond) => (xs) => foldr
    (xs)
    ( (value) => (already_filtered) => (f) => (x) =>
        cond(value)
            ? f(value)(foldr(already_filtered)(f)(x))
            : foldr(already_filtered)(f)(x))
    (nil);
```

This one is a doozy, no doubt. The function being folded over the list tests
the current value of the list. If the result is true, we (manually) `cons` it
to the current result. If not, we continue with the current result unchanged.

Concatenating (or "appending") one list to another
---

```javascript
let concat = (xs) => (ys) => foldr(xs)(cons)(ys);
```

This works because the "initial result" -- the right-half of the list -- is the
second list. Then starting from the end, each element of the first list is
appended to the second list.

Flattening a list of lists
---

```javascript
let flatten = (xs) => foldr(xs)(concat)(nil);
let person_a_groceries = cons ('rice') (cons ('oranges') (nil));
let person_b_groceries = cons ('monster') (cons ('nos') (cons ('hot cheetos')
                              (nil)));
let shopping_list = flatten( cons (person_a_groceries)
                           ( cons (person_b_groceries)
                           ( nil )));
```

You have a way of combining two lists and a starting value (ie, an empty list).
This folds `concat` over a list of lists, which flattens it.

Something curious to comprehend
===

Here's a weirdo:

```javascript
let flatMap = (list) => (f) => flatten( map (f) (list) );
```

This maps a function over a list, turning each element of the list *into a
list.* And then it flattens this list of lists back down.

When would you use this?

If you were writing event planning software, you might have a list of events,
and a function `attendees` which takes an event and returns a list of guests.

```javascript
let events = getEventsThisWeek();
let attending = flatMap (events) (attendees);
```

If you had three events, the first might have 15 attendees, the second might
have -- wait. Wait a second.

The length of the list grew. `map` can't do that. `filter` can only shorten
lists, and only using a yes/no condition. But `flatMap` can change not just the
values of a list but the *structure* of the list as well. Hmm.

Maybe you're working on some retail software and you want to spam users with
shitty advertisements. You can query the list of past customers and product
categories easily. You also have a function telling you if a customer likes a
category, and one which handles creating the advertisement for a customer and
a product.

Voici:

```javascript
let customers = getCustomers();
let categories = getCategories();
let adsToSend =
    flatMap (customers)  ((customer) =>
    flatMap (categories) ((category) =>
        (likes(customer,category))
            ? flatMap (products(category)) ((product) =>
                unit(ad(customer,product)))
            : nil ));

let unit = (x) => cons (x) (nil);
```

The logic looks more or less like how you'd handle one combination of
variables: take a customer from the customers, a category from the categories,
and then if the customer likes the category take a product from the products
and send out the ad.

It's easy to reason about. But the key is, it implicitly loops over each of the
lists and produces not just the results of one combination but the results for
*all* combinations.

In Python you may have seen this before: this is known as a *list
comprehension.* They have syntactic support there and thus are a little more
elegant. But then, this is a very naive implementation of lists and utilities;
the popular [lodash][lodash] JavaScript library has this capability implemented
in a very sophisticated and efficient manner.

Their implementation is undoubtedly different in order to take advantage of
clever hacks and optimizations. But ultimately comprehensions are the flattened
results of special map operations.

Where to from here?
===

Holy shit we covered a lot in this. We:

1. Constructed lists using elementary lambda calculus;
2. Implemented a useful library of list processing functions; and
3. Derived list comprehensions from scratch.

And really [the code for it all isn't that long][thecode]. You can download it,
put it in a file, and play around with it in [node][nodejs].

There are several places to go from here, which I hope to write about soon:

- Creating and processing *infinite* lists;
- Deriving `flatMap` for other structures and 
- Splitting a list into its first element ("head") and rest ("tail"), based on
  Church numeral *subtraction*;
- honestly, I shouldn't promise too much just yet.

This is a lot of weird, more-than-likely new stuff. Play with the code. It
won't make sense all at once but it might help you begin to think about how you
design and implement programs in a different way.

[church]: http://niltag.net/essays/church.html
[lodash]: https://lodash.com
[thecode]: https://gist.github.com/gatlin/5b022bc38aa9f5a2b63a75580a056e8c
[nodejs]: https://nodejs.org/en/
[^1]: The terms *cons* and *nil* come from the lisp family of languages, where
    lists are the central data structure. *cons* means "construct." Since
    it's short and kind of makes sense I'm using it here as well.

[^2]: While some tricks could be performed, for the most part this isn't a very
    efficient implementation of lists in JavaScript. Part of the problem is
    each operation tears down and then builds up a new list. So if you have a
    chain of list operations you might free and re-allocate memory
    unnecessarily. The value in this implementation, though, is it is easy to
    verify the correctness of your algorithms so you know what to expect from
    more optimized implementations. Some languages also support the notion of
    *list fusion*, where a series of list destructions and reconstructions can
    be fused into one operation which destroys and recreates the list once.
    Then Church encoded lists can be quite speedy.
