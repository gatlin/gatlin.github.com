---
title: Writing a billing system in Haskell, using Stripe and Heroku
lead: Proof that necessity is not the mother of invention.
...

*This post is written in literate Haskell, meaning the source can be turned
into a blogpost or a working program. You can view the [source][source].

[source]: https://gist.github.com/gatlin/7754289

Normally clients pay me with checks, but recently one informed me that they
really really really like *really really* super prefer some kind of online
payment form.

Fair enough. I want to accommodate them. So, this weekend I did the only
logical thing: I wrote my own payment system. What, did you think I was going
to use PayPal?

(Don't worry, Mom, I thought about PCI compliance and all that. Read more!)

For both ease and security I opted to use [Stripe][stripe], a straightforward
service which handles all the legal and regulatory concerns and provides
developers with a nice API to build on top of. Here's how it works:

[stripe]: http://stripe.com

1. On the actual billing page, I securely send Stripe the credit card details and a
special, public token issued to me. I get back a transaction token **instead of
sensitive credit card information.**

2. Then, I send the amount and the transaction token up to my payment backend.
The payment backend does whatever administrative work and validation it needs
to before sending Stripe the transaction token, the amount, and a **secret**
token only I know.

![This is some James Bond shit.](http://i.imgur.com/4oNzWuPl.jpg)

To counteract all this ease and security, I decided to write the payment
backend in Haskell. I learned a lot about how Haskell web applications work and
figure I'd detail some of that. Now, onward to the code!

The code
---

First, with any Haskell program complex enough to be useful, the first 30 lines
or so are imports, viz:


> {-# LANGUAGE OverloadedStrings, ScopedTypeVariables #-}
> module Main where
>
> import Prelude
> import Web.Stripe.Charge ( Charge(..), Amount(..), Count(..), Currency(..)
>                          , Offset(..), getCharges, chargeToken
>                          )
> import Web.Stripe.Client ( APIKey(..), StripeConfig, defaultConfig, runStripeT )
> import Web.Stripe.Token (Token(..), TokenId(..), getToken)
> import System.Environment
> import Network.HTTP.Types (status200, status404, status303)
> import Network.HTTP.Types.URI (Query, QueryItem, parseQuery)
> import Network.Wai
> import Network.Wai.Handler.Warp (run, Port)
> import Network.Wai.Middleware.RequestLogger (logStdout)
> import Data.ByteString.Lazy.Char8 as BC hiding (map)
> import Data.ByteString.Lazy as BL hiding (map)
> import Data.ByteString as BS hiding (map)
> import Data.Maybe hiding (catMaybes)
> import Control.Monad
> import Data.Map as M hiding (map)
> import Data.Conduit
> import Data.Conduit.List hiding (map, head)
> import Data.Text.Encoding (decodeUtf8)
> import Control.Monad.IO.Class (liftIO)
> import Network.Wai.Util (redirect)
> import Network.URI (parseURI)

That's quite a bit! I included the [hs-stripe][hsstripe] package;
`System.Environment` in order to read the correct port number from the, uh,
system environment; a lot of `Network.*` libraries to get access to raw
connection details; and of course 30 kinds of ByteString for reasons I'm sure
the creators can defend elegantly.

I also used two GHC Haskell language extensions: `OverloadedStrings` to
accommodate the trainwreck that is mixing `String`, `ByteString`, and `Text`
all in the same application; and `ScopedTypeVariables` for reasons that will
make more sense in context.

Because I was short on time, I figured I'd rather not use a fancy shmancy
framework to abstract my application but instead to use the Web Application
Interface (WAI) directly. Boy did I waste a lot more time.

[hsstripe]: https://github.com/michaelschade/hs-stripe

Top level application setup
---

> withApp :: (Application -> IO ()) -> IO ()
> withApp handler = handler application
>
> application :: Application
> application r@Request{requestMethod = m, pathInfo = p} = do
>     case (m, p) of
>         ("POST", ["charge"]) -> handlePostToken r
>         _                    -> return notFound
>
> notFound = responseLBS
>     status404
>     [("Content-Type", "text/plain")]
>     "404 Not Found"

The `application` function accepts a `Request` value and dispatches the
appropriate handler function. Here `ScopedTypeVariables` becomes very handy: I
can refer to both the entire `Request` as a whole and also refer to some of its
constituent parts, such as the `requestMethod` and `pathInfo`.

As you might be able to tell, we have bound one handler in this version of the
application: a `POST` submission to the `/charge` path will charge the credit
card. It's heating up in here!

`withApp` is a convenience function to make gluing everything together pretty
later. You'll see below.

Go ahead and guess what the `notFound` handler is responsible for.

Stripe configuration
---

> conf :: StripeConfig
> conf  = defaultConfig $ APIKey "YOUR_STRIPE_SECRET_TOKEN"

`conf` creates a StripeConfig value based on your secret token. I omitted mine
here for obvious reasons.

Handlers
---

Okay, now we get our hands dirty.

Let me be the first to say that this is not my finest work. I would call myself
and intermediate Haskeller and I was also on a bit of a time constraint.
However, I learned enough to know what I'll improve upon in due time.

![Shall we begin?](http://i.imgur.com/02IjGIJ.gif)

> handlePostToken req = do
>     bodyLst <- requestBody req $$ consume

The first thing to know is that WAI uses the infamous `conduit` library.
`conduit` is a Haskell library for efficiently handling large streams of data
in constant memory. You see, Haskell is aggressively *lazy*: it defers actual
computation until the last possible moment in order to avoid unnecessary
calculations. While slick, this means it accumulates a lot of memory and makes
IO kind of painful and slow. `conduit` presents a different model.

At a high level, there are `Source`s and `Sink`s. You can fuse a `Source` and a
`Sink` together to create a `Conduit` (*ahem*) and start creating pipelines to
transform data. [Conduit is nifty.][conduit]

It's also a fucking [type nightmare][nightmare].

[nightmare]: http://hackage.haskell.org/package/conduit-1.0.9.3/docs/src/Data-Conduit-Internal.html#ConduitM
[conduit]: http://hackage.haskell.org/package/conduit

Anyway, the request body, it turns out, is a `Source` wrapping a `ByteString`.
I used the `consume` function from `Data.Conduit.List` to read in the request
data. Why? Frankly, `conduit` proved to be a worthy foe and around 3 hours into
this I went with whatever code examples I could find on StackOverflow.

>     bodyStr <- return $ bodyLst !! 0
>     bodyMap <- return $ M.fromList $ parseQuery bodyStr

After consuming the request body into a list of 1 item, I set `bodyStr` to the
first element, a ByteString. Let's take a step back: the format of the request
body is thus:

    token=TRANSACTION_TOKEN&amount=35000

In other words, it's an HTTP query string. There is a function called
`parseQuery` in `Network.HTTP.Types.URI` which turns query strings into lists
of tuples, eg:

    [("token", Maybe "TRANSACTION_TOKEN"), ("amount", Maybe "35000")]

The `Maybe` wrapper is there to ensure our program doesn't fail if someone
leaves out the amount (sneaky buggers).

However, I want to ... query ... the query string for values easily. I could
roll my own code to search through this list and find the right values, or I
could not be an idiot and use `Data.Map.fromlist` to turn it into a map
structure for me.

Which is, for the record, exactly what I do in creating `bodyMap`.

### Monads and Monad Transformers

Yeah, you knew this was coming. I'm not going to explain what monads are in
this post. However, to actually understand this code it's important to know
which monad we are in and why.

The monad in question here is `ResourceT m a`. According to the
[documentation][resourcet] it "keeps track of all registered actions, and
calls them upon exit". Specifically, while you're busy fusing `Source`s and
`Sink`s and `Conduit`s and transforming shit all over the place, you're also
allocating resources that must be deallocated or else your program will crash
and you won't get paid.

`ResourceT m a` along with other `conduit` related operations and types appears
to handle all of this internally. By writing code in the `ResourceT m a` monad
and declaratively setting up your pipeline, you're getting all the bookkeeping
done for free.

But wait, what does that "T" at the end of `ResourceT` mean? Well, `ResourceT m
a` is a *monad transformer.* The problem monad transformers solve is very
eloquently described [here][monadtransformers]. In essence, they allow you to
wrap a monad inside another monad.

Make your inception jokes here.

The "m" in its type signature represents an inner monad. For example, later on
in the code we are going to dive into a special Stripe monad for handling
interactions with their server. `ResourceT m a` allows us to be in the magical
resource management monad but still call into other monads that are useful
during our computation.

[monadtransformers]: http://book.realworldhaskell.org/read/monad-transformers.html

It's some sick shit.

### Moving on

[resourcet]: http://hackage.haskell.org/package/conduit-1.0.9.3/docs/Data-Conduit.html#g:10

>     case M.lookup "amount" bodyMap of
>         Nothing -> return $ doRespond "bad amount"

First, we see if an amount was specified. `Data.Map.lookup` takes a key and a
map and returns a `Maybe` value. If the `Maybe` value is `Nothing` then I
initiate the sophisticated error handling code you see above.

>         Just amt -> do
>             amtInt <- return $ fst . fromJust . BC.readInt $ BC.fromChunks . (:[]) $ fromJust $ amt

... and if I get something, I write complete gibberish and get sent away to an
island with other crazy people like me.

Actually, this code is more complicated than strictly necessary because I'm
using the package `bytestring` 0.9.x and not 0.10.x because logistical reasons
(namely, the boilerplate code I started from to interact with Heroku uses 0.9.x
and I got lazy).

`amt` is itself a `Maybe` value. Remember the `("amount", Maybe "35000")` in
the query string list above? So, over on the right side of the line we use
`Data.Maybe.fromJust` to unwrap the actual `ByteString`. The

    BC.fromChunks . (:[])

composed function is a trick I found on StackOverflow to convert from strict
`ByteString`s - the kind I consumed from the request body - to lazy
`ByteString`s so that I could use the `readInt` function.

However, `readInt` also returns a `Maybe` value because there is a chance that
the `ByteString` will be some stupid shit like "100xyz" or "three" and fail. I
do validation elsewhere (*cough*) and don't worry about it here.

Finally, for some reason the value inside the `Maybe` is a tuple consisting of
the result and the original value. So I use the standard `fst` function to grab
the first element from the tuple, which is our `Int`. And then I `return` it to
our monad.

Fuck.

>             case M.lookup "token" bodyMap of
>                 Nothing -> return $ doRespond "no token"

Next, I check to see if a token was given, and apply standard error handling
wizardry in the event that no token was given.

>                 Just val -> do
>                     finalVal <- runStripeT conf $ do
>                         theToken <- getToken $ TokenId $ decodeUtf8 . fromJust $ val
>                         chargeToken theToken (Amount amtInt) (Currency "usd") Nothing Nothing

If a token was specified, I finally get to talk to Stripe! Hooray! Money! Here
I use `runStripeT` to take the `StripeConfig` value we created oh-so many years
ago and dive into a special Stripe monad.

The reason for the Stripe monad is to hide the complexity of calling a remote
web service in real time. The connection might fail, or Stripe's servers might
fail and ask for a retry, or any number of things could happen. Stripe's monad,
though, lets me declare what I would like done and handles it for me.

Though I store the result in `finalVal`, I don't do anything with it - yet.
This isn't my final version, and I plan on handling error cases later using
finalVal. For now, though, this suffices, because at my low volume I'll see
erroneous payments on my Stripe dashboard and handle them case by case.

>                     return $ fromJust $ redirect
>                         status303
>                         [] $
>                         fromJust $ parseURI "http://niltag.net/billing/thankyou.html"

Here we go, the big one: we contacted Stripe with a token and an amount and got
something back and now we grovel to our monied overlords and send them to a
thank you page. The `redirect` function from the `wai-util` package sets up the
appropriate headers and whatnot to tell the client's browser to redirect. In
this case, I send them to a patronizing "thank you" page.

>     where
>         doRespond v = responseLBS
>             status200
>             [("Content-Type","text/plain")]
>             v

`doRespond` is a simple inner function to factor out repetitive code.

Let's get the hell out of here
---

> main = do
>   portStr <- getEnv "PORT"
>   let port = read portStr :: Port
>   withApp (\app -> (run port) (middleware $ app))
>
> middleware = logStdout

Finally, our `main` function, where the program actually starts. It's pretty
boring: grab the port value from the system environment, convert it to an Int,
and then ... what?

Oh yeah, there's `withApp` again. Did you think I'd forget? `withApp` here
receives a lambda function which will take its argument, and do two things:

1. Construct a web server using `run` and the port number; and
2. Compose some server middleware with our actual application and feed it to
the server.

Above, remember that we defined `withApp` as accepting a handler function as
its sole argument and applying to `application`. Our lambda here is that
handler function. If you're going cross eyed, that's perfectly normal.

The middleware is a standard middleware to log requests to the console, which I
found useful during debugging.

The end is nigh
---

So, that's more or less the first version of my little payment gateway. I
successfully charged myself a dollar, which after Stripe's 2.9% + $0.30
commission, will leave me with $0.67 in about 7 days.

The reason the port number is read from the system environment is so that I can
interface with Heroku. They decide dynamically what port to assign your
application and it's easier for everyone if you just read it from the
environment. Don't ask questions.

I'm pretty happy with this. I learned quite a bit about the fundamentals of
Haskell web applications, monad transformers, and the nightmare that was
`ByteString` (which I didn't have the energy to write about, frankly).

If you have any comments or questions, please email me at <gatlin@niltag.net>.

