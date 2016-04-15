---
title: Lambda calculus and Church numerals
lead: Or, DIY arithmetic
...

This post will contain JavaScript code which you can run using [node][nodejs].
Or you can try it all out [in your browser using repl.it][replit].

From zero to zero
===

Just for kicks - in no way premeditatively or anything - I'm going write a
silly little function called `_0`:

```javascript
let _0 = (f) => (x) => x;
```

This function takes an argument `f`, returns a new function accepting an
argument `x`, and just returns `x`. It forgets about `f`.

Of what use could this possibly be, you ask? I have a different question: why
did I name it `_0`? The underscore is simply because I can't start variable
names in JavaScript with numbers.

What about this function relates to the number 0? Maybe it'll be clearer if I
show the next silly little function:

```javascript
let _1 = (f) => (x) => f(x);
```

Both functions took two arguments; `_0` used the first one 0 times, and `_1`
used it 1 time. And I bet you'll never guess what the name of this function is:

```javascript
let mystery = (f) => (x) => f(f(x));
```

If you guessed `_2` I want you to know I'm very proud of you. These silly
little functions correspond to positive integers (and 0). To drive this point
home I'll write a function which converts them into JavaScript integers:

```javascript
let actualNumber = (n) => n((x) => x + 1)(0);
```

Indeed, if you play with it you'll see that

    actualNumber(_0)    = 0
    actualNumber(_1)    = 1
    actualNumber(_2)    = 2

and so on. We might be on to something here!

A trip to Church
===

A long time ago a fellow named [Alonzo Church][church] started fooling around
with these. They're now called *Church numerals*. But why?

He was studying a subject called *lambda calculus.* Lambda calculus is really
quite simple: it is the study and application of so-called *lambda functions.*
Lambda functions are traditionally written like this[^1] :

    λf. λx. f x

You may notice this bears striking resemblance to our friend `_1` and that's
because, well, *it is `_1`*.

In lambda calculus, the *only* thing you work with are lambda functions. At its
foundation there are no numbers, no addition or multiplication, no nothing.
Functions take functions as arguments, and produce functions as results.

**And yet** lambda calculus forms the theoretical underpinnings of computer
science and can serve as the foundation for mathematics. How?! Easy: he simply
constructed numbers and arithmetic out of lambda functions.

The purpose of this post is to retrace those steps.

One more time!
===

Church numerals are are just functions. They ask for two parameters and then
apply the first one to the second some number of times and in this way they
encode real data.

But if they're *really* numbers, then I should be able to add them, right?
Adding `_1` and `_2` should give me `_3` and multiplying `_2` and `_3` should
give `_6`. Can we do that?

Let's start small. Let's write a function which, given a Church numeral,
increments it by 1. We know that this function's argument is going to be some
numeral - say, `n` - so let's not overthink this too much:

```javascript
let incr = (n) => ???
```

The result of the function is going to be a Church numeral, right? Thus the
beginning of the result is going to take an `f` and an `x`. We may proceed
pretty mindlessly:

```javascript
let incr = (n) => (f) => (x) => ???
```

Now here's the tricky part. `n` is a function taking `f` and `x`, too, and it
will apply `f` to `x` some number of times. So we know we need to give `n` its
arguments:

```javascript
let incr_wrong = (n) => (f) => (x) => n(f)(x);
```

This isn't quite right, though. Giving `n` the `f` and `x` will apply `f` to
`x` a certain number of times, but we want to apply `f` *one more time*.

Again, let's not overthink this. We already have `f` so let's ... apply `f`
*one more time*:

```javascript
let incr = (n) => (f) => (x) => f(n(f)(x));
// see? ------------------------^
```

Let's be sure this works:

    incr(_1)
    =>
    (λn. λf. λx. f ((n f) x)) (λf. λx. f x)
    \-------- incr ---------/ \--- _1 ----/
    =>
    λf. λx. f ((  (λf. λx. f x) f ) x)
    =>
    λf. λx. f ( f x )

Sure enough, that's `_2`! How about `incr(_0)` ?

    incr(_0)
    =>
    (λn. λf. λx. f ((n f) x)) (λf. λx. x)
    \-------- incr ---------/ \-- _0 ---/
    =>
    λf. λx. f ((  (λf. λx. x) f ) x)
    =>
    λf. λx. f (x)

I don't know about you but I'm convinced.

Additionally ...
===

Now we are ready to tackle a slightly more complex problem: adding two Church
numerals. So we have some number `a` which applies `f` some number *a* times and some
number `b` which applies `f` some number *b* times.

As with `incr` we know that we're going to take two numbers and return a third
so we can get this out of the way:

```javascript
let add = (a) => (b) => (f) => (x) => ???
```

Cool. A Church numeral applies its first argument to its second argument any
number of times. We're adding `a` and `b` so we know we want `f` applied *at
least* *a* times:

```javascript
let add_almost = (a) => (b) => (f) => (x) => a(f)(x);
```

We want to take the result of `a(f)(x)` and then apply `f` `b` more times to
it. It's *really* easy to over think this!

```javascript
let add = (a) => (b) => (f) => (x) => b(f)( a(f)(x) );
```

`b` will do the work of applying `f` *b* times, and `a` will do the work of
applying `f` *a* times.

Let's test our function by adding `_1` and `_2`:

    add(_1)(_2)
    =>
    (λa. λb. λf. λx. (b f)((a f) x)) (λf. λx. f x) (λf. λx. f (f x))
    \----------- add --------------/ \--- _1 ----/ \----- _2 ------/
    =>
    λf. λx. ((λf. λx. f (f x)) f)  (((λf. λx. f x) f) x)
            \------- _2 --------/  \-------- _1 -------/
    =>
    λf. λx. (λx. f (f x))  (((λf. λx. f x) f) x)
    =>
    λf. λx. (f (f (((λf. λx. f x) f) x)))
    =>
    λf. λx. f (f (f x))

`f` is applied three times so we indeed got `_3`!

Do you have the times?
===

Triumphant and cocky let's now try our hands at multiplication. This is
trickier: for each time `a` would normally apply `f`, we want to apply it b
times instead. You know the drill:

```javascript
let mul = (a) => (b) => (f) => (x) => ???
```

`a` will apply its first argument to its second *a* times; `b` will similarly
apply `f` *b* times.

So what if `(b f)` was the function given as the first argument to `a`? Then
`a` would apply `(b f)` *a* times and each time `b` would apply `f` *b* times.

```javascript
let mul = (a) => (b) => (f) => (x) => a(b(f))(x);
```

I'll leave it as an exercise for the reader to work this one out.

Don't be listless, this is where it gets good
===

It's pretty interesting[^2] that we can represent numbers and arithmetic using
lambda calculus, but what else can we do?

I'm going to provocatively rename `_0`.

```javascript
let nil = (c) => (n) => n;
```

Imagine if the `f` that we gave our Church numerals required *2* values?
Something like, I don't know,

```javascript
let prepend = (hd) => (tl) => [hd].concat(tl);
```

`prepend` does exactly what it says: takes a value and an array and prepends
the value to the array.

Our `incr` function would have to look a little bit different: "incrementing"
isn't just applying `f` to `x` one more time, it means giving `f` another
value and *then* applying it to `x`.

To ruin the surprise I'll name this modified incrementer `cons`:

```javascript
let cons = (hd) => (tl) => (c) => (n) => c(x)(xs(c)(n));
```

Let's see it in action:

```javascript
let example_list = cons(1) (cons(2) (cons(3) (nil)));
```

And ...

```javascript
console.log(example_list); // outputs: "[Function]"
```

That was anti-climactic. Of course, just like with Church numerals, we have to
provide a little conversion function:

```javascript
let actualList = (lst) => lst(prepend)([]);
```

Let's try again:

```javascript
console.log(actualList(example_list)); // outputs: "[ 1, 2, 3 ]"
```

HOLY MOLY. So we can represent lists, too! We just made a data structure out of
lambda functions.

Note, though, that we could actually use any two-argument function and any base
starting value. Let's write a function I'll call `foldr`:

```javascript
let foldr = (lst) => (step) => (initial) => lst(step)(initial);
```

What's the big deal here?

```javascript
console.log(foldr(example_list)( (a) => (b) => a+b )( 0 ));
// outputs: "6"
```

Holy crap. `foldr` is a right fold - what a lucky coincidence I gave it that
name, huh?

I could go on about [folds][cata] and how you can define data structures by the
way in which you destroy them, and then subsequently wax romantic about how
this really is the nature of existence, but I'll stop here.

The Big Picture
===

I think it's very profound that we are able to construct data out of functions,
blurring the line between the two. This turns out to give lambda calculus
sufficient expressive power to compute anything which can be computed.

The [Church-Turing thesis][ctthesis] showed that Turing machines are equivalent
to the lambda calculus and thus are also powerful enough to express any
computation.

And, notably, in a Turing machine there is no distinction between code and data.

In practice programming languages assume the ability to perform arithmetic,
create and iterate through lists, perform side effects, and other sophisticated
operations for readability and efficiency.

But ultimately, they all reduce to the lambda calculus, and I hope this essay
was able to hint at how and why.

[nodejs]: https://nodejs.org/en/
[cata]: https://en.wikipedia.org/wiki/Catamorphism
[church]: https://en.wikipedia.org/wiki/Alonzo_Church
[ctthesis]: https://en.wikipedia.org/wiki/Church%E2%80%93Turing_thesis
[replit]: https://repl.it/languages/javascript
[^1]: The little "λ" is the Greek lower-case letter *lambda*, by the way.
[^2]: Well, *I* think so.
