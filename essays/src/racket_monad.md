---
title: What the fuck is a monad?
lead: "Or: drinking alone isn't healthy"
...

*This post was updated from the original; feel free to send me feedback at
<gatlin@niltag.net> !*

Monads are difficult to explain without sounding condescending. There's a lot
of anxiety around the topic which compounds the already-significant barriers
to entry: namely abstraction, vocabulary, and dependence on other ideas 
ideas you didn't ask about.

Instead, I'll frame a problem and piece-by-piece solve the problem with what
will turn out to be a monad.

This post is written in [Typed Racket][typedracket] which you can download for
free at [the Racket website][racket].

# Overview: monads, in effect

Typed Racket is a functional programming language which heavily discourages
imperative programming styles. Like, for instance, programs of this sort:

```python
def get_customer_referrals(customers):
    responses = []
    for customer in customers:
        referrals = get_referrals(customer)
        responses.append(referrals)
    return responses
```

While in Python a definition such as this is called a "function" I prefer
instead the term *procedure*. Functions are like this:

    f (x) = x + 1

If I give `f` a `1` I will always get back a `2`. No discussion. If I ever did
get something else back, may the gods have mercy on all of us. `procedures` do
not afford us this sort of guarantee, but they also don't require special blog
posts in order to understand and use them to get shit done. So there's that.

Imperative programming makes use of *side-effects*: I may write code which
alters a database, or reads the time, or has some other side-effect on the
state of the machine or surrounding world. In our example above, the procedure
takes a list of people (of size `N`) and returns a list of responses (of size
`M`, which may or may not be `N`).

How can we model side-effects such as this? And while we're at it, can we get
rid of the boilerplate list-building code as well? Monads supply an answer for
both.

# What the functor ... ?

To start our journey toward monads, we must first define functors. For our
purposes, a *functor* is a container type `T` which wraps any arbitrary type
`a`, and allows functions of type `a -> b` to be mapped inside the container.

Concrete example: lists are functors, where `T` is `List` and `a` is whatever
you have a list of - numbers, strings, booleans, etc.

In fact, in Racket lists also already have a function called `map` which given
a function `a -> b` transforms a `List a` into a `List b`:

```scheme
(: even? (-> Integer Boolean))
(define (even? n) (eq? (modulo n 2) 0))

(map even? '(1 2 3))
```

What happens is like this:

    [ 1        2        3  ]
      |        |        |
    even?    even?    even?
      |        |        |
      v        v        v
    [ #f       #t       #f ]

Here we converted a `List Integer` into a `List Boolean`.

# Universal unitarianism

So now we know what functors are: higher-order container types which permit
arbitrary functions to be mapped inside of them.

There is one limitation, though. Say you're using the list functor; if you map
a function over a list of 5 elements, you'll get back a list of 5 elements.

But what if you can't or shouldn't assume that your result list will have the
same length as your argument list? That is the case for the motivating example
at the start of this essay. An even simpler example would be filtering a list
of numbers: the result may be shorter than the argument list.

There are many ways to skin this cat but one is to return a list of lists. For
filtering, this entails mapping each value of the list into an empty list
(failure) or a list of one item (success). A function of type `a -> T a`, where
`T` is a functor, is called *unit*. Here is the list unit:

```scheme
(: list-unit (All (a) (-> a (Listof a))))
(define (list-unit x) (cons x '()))
```

Using it, let's write a function which checks if a number is even and instead
of returning `#t` or `#f` returns a singleton list or an empty list:

```scheme
(: list-even? (-> Integer (Listof Integer)))
(define (list-even? n)
  (if (eq? (modulo n 2) 0)
      (list-unit n)
      '()))

(: my-filter (All (a) (-> (-> a (Listof a))
                          (Listof a)
                          (Listof (Listof a)))))
(define (my-filter predicate lst) (map predicate lst))

(my-filter list-even? '(1 2 3))
```

The computation proceeds like this:

    [ 1            2            3  ]
      |            |            |
    list-even?   list-even?   list-even?
      |            |            |
      v            v            v
    [ []          [2]          []  ]

So the result list *is the same length* as the input list, but all the values
are even.

# Join me, and together we can bring boredom to the Force

Getting back a list of lists is cool and all, but when I filter items out of a
list I expect to get back a list of values, not a list of lists. The reason is
I might want to process this list further, and I don't want to have to write
brittle, specialized procedures dealing with increasingly-nested layers of
lists.

No, when I filter a `List a` I want to get back a `List a`. We already have a
`List (List a)`; can we write a routine to flatten out a list of lists?

Absolutely! If you have a function of type `T (T a) -> T a` for some functor
`T`, it is often called *join*. Here is the list join:

```scheme
(: list-join (All (a) (-> (Listof (Listof a)) (Listof a))))
(define (list-join xss)
  (foldr (λ: ([ y  : (Listof a)]
              [ ys : (Listof a)]) (append y ys))
    empty xss))

(list-join '( () (2) () ))
```

This executes like so:

    [ []          [2]          []  ]

                  ---
                  | |
                 \   /
                  \ /
                   v

    [              2               ]

We did it! We wrote a function which maps over a list and changes the structure
of the list itself. In this case, a list's "structure" is its length. Different
types will allow for different transformations.

# We're in a bind ...

Actually, this pattern of `join`ing the result of a `map` and `unit` is so
common it has its own name: *bind*.

*bind* is a map which can alter structure as it goes from element to element.
Regardless of what `T` is, bind always has the same definition:

```scheme
(: bind (All (a b) (-> (T a)
                       (-> a (T b))
                       (T b))))
(define (bind container f) (join (map f container)))
```

Of course that won't work in Typed Racket; you must substitute specific `join`
and `map` functions. But here is the `list-bind`:

```scheme
(: list-bind (All (a b) (-> (Listof a) (-> a (Listof b)) (Listof b))))
(define (list-bind lst f) (list-join (map f ma)))
```

Now we can write our code much more elegantly:

```scheme
(list-bind '(1 2 3) list-even?)
```

Note that `list-even?` accepts a single scalar number as an argument, yet using
`list-bind` it is run over the whole list, resulting in a list of a different
length.

The whole computation looks like this:

    [ 1            2            3 ]
      |            |            |
    list-even?   list-even?   list-even? -- map / unit
      |            |            |
      v            v            v
    [ []          [2]          [] ]      -- join
      |            |            |
      v            v            v
    [              2              ]

This is, in essence, what a monad is: a structure that lets you map a function
into the structure which may, as a side-effect, change the structure. Different
monads allow for different side-effects.

I want to demonstrate another functor (more succinctly than I did for lists, to
be certain) but first, let's tackle the example from the beginning of this
post.

As in that snippet, assume here that `get-referrals` is defined meaningfully.
So that this example will compile, I'll write a dummy version that spits out
three referrals for each customer given:

```scheme
(: get-referrals (-> String (Listof String)))
(define (get-referrals customer)
  (map (λ: ([n : String])
    (string-append customer " referral: " n))
    '("1" "2" "3")))
```

Finally, then, we can recreate the Python code:

```scheme
(: get-customer-referrals (-> (Listof String) (Listof String)))
(define (get-customer-referrals customers)
  (list-bind customers get-referrals))
```

The result is a list of referrals which may be empty, shorter than, longer
than, or equal to the input list of customers.

# Other monads

An even simpler monad is what I call the `Box`: it's like a list that has
exactly one item. On its own, this doesn't do much for us. But as a monad, it
is pretty interesting.

```scheme
(struct: (a) Box ([open : a]))

(: box-map (All (a b) (-> (-> a b) (Box a) (Box b))))
(define (box-map f bx)
  (Box (f (Box-open bx))))

(: box-unit (All (a) (-> a (Box a))))
(define (box-unit x) (Box x))

(: box-join (All (a) (-> (Box (Box a)) (Box a))))
(define (box-join bx) (Box-open bx))

(: box-bind (All (a b) (-> (Box a) (-> a (Box b)) (Box b))))
(define (box-bind ma f) (box-join (box-map f ma)))
```

And for shits and giggles here are two innocuous functions:

```scheme
(: box-even? (-> Integer (Box Boolean)))
(define (box-even? n)
  (if (eq? (modulo n 2) 0)
    (Box #t)
    (Box #f)))

(: imperative-1 (-> Integer (Box String)))
(define (imperative-1 n)
  (box-bind (box-even? n) (λ: ([b : Boolean])
  (box-return (if b "Even" "Odd")))))

(Box-open (imperative-1 10))
(Box-open (imperative-1 11))
```

If you squint, this *sort of* looks like an imperative program where you assign
the results of function calls to temporary variables. That's what the `Box`
monad gives us: simple imperative programming.

Also: this is lisp! You don't have to pretend! For the sake of completion,
below is a macro that gives us an imperative syntax for monads. You don't need
to understand but it might be interesting nonetheless.

```scheme
; these libraries both ship by default with Racket
(require (for-syntax racket/syntax))
(require racket/stxparam)

(define-syntax-parameter bind (syntax-rules ()))
(define-syntax-parameter return (syntax-rules ()))

(define-syntax do^
  (syntax-rules (:= let)
    ((_ (:= v e) e2 es ...)
     (bind e (lambda (v) (do^ e2 es ...))))
    ((_ (let [v e] ...) e2 es ...)
     (let ((v e) ...)
       (do^ e2 es ...)))
    ((_ e e2 es ...) (bind e (lambda (_) (do^ e2 es ...))))
    ((_ e) e)))

(define-syntax (do stx)
  (syntax-case stx ()
    ((_ prefix e1 e2 ...)
     (with-syntax ((prefix-bind (format-id #'prefix "~a-bind" #'prefix))
                   (prefix-return (format-id #'return "~a-unit" #'prefix)))
       #'(syntax-parameterize ((bind (make-rename-transformer #'prefix-bind))
                               (return (make-rename-transformer #'prefix-return)))
                              (do^ e1 e2 ...))))))
```

*Thanks to user chandler on the #racket IRC room for teaching me how to do this.*

We can rewrite `imperative-1`:

```scheme
(: imperative-2 (-> Integer (Box String)))
(define (imperative-2 n)
  (do box
    (b := (box-even? n))
    (return (if b "Even" "Odd"))))
```

For that matter, we can use this slick notation on list computations as well:

```scheme
; Function written to process one item of a list
(: list-times-5-if-even (-> Integer (Listof Integer)))
(define (list-times-5-if-even n)
  (do list
    (is-even := (return (even? n)))
    (return (if is-even (* n 5) n))))

; that very same function automatically applied to the whole list
(list-bind '(1 2 3 4 5) list-times-5-if-even)
; => '(1 10 3 20 5)
```

You get the idea.

# Conclusion and further points of interest

Monads aren't hard: they are containers of other values which not only allow
the values to be transformed, but the container itself. The structural change
is called a *side-effect* and different monads allow for the controlled
propagation of different side effects.

Where all this nonsense really becomes interesting is when you write generic
"monadic" functions - not specific to any particular monad - and are able to
get different behaviors depending on the monad you choose.

For instance, I could write a simple monadic function to multiply a number by
two. Fed into a `Box` monad, this simply lets me use it in an imperative
function. Fed into a `List` monad, this function is automatically applied to a
list of values.

The `list-times-5-if-even` function doesn't have anything in it specific to
lists; unfortunately, Typed Racket's type inference engine is still a bit
lacking.

But that's just the tip of the iceberg; now that you have the fundamentals, go
read more!

[typedracket]: http://docs.racket-lang.org/ts-guide/index.html
[racket]: http://racket-lang.org
