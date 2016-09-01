---
title: A Haskell Twitter Shitposting Framework
lead: Or in other words I essentially built myself
...

Recently I've had the urge to write a Twitter bot but I don't actually know
*what* I want it to do yet. So I did what any self-respecting functional
programmer would do: I wrote a bunch of tools to make writing bots easier!

So I took a look at the Twitter API[^1] and got to hacking. It was fun and while
I'm not done implementing every little piece I thought I would showcase a style
of programming that is quite nice in Haskell. Using my library writing a Twitter
bot is as simple as this:

```haskell
sendExampleTweet = runTwitter credentials $ do
    status <- tweet "Sending an example tweet!"
    liftIO . putStrLn $ case statusCode status of
        200 -> "Success!"
        _   -> "Couldn't send Tweet :("
```

Or this:

```haskell
exampleSearchStream = runTwitter credentials $ do
    publicStream ["dog","dogs"] $ \status tweets ->
        when (statusCode status == 200) $
            runTube $ for (sample tweets) doSomethingWithDogTweet
```

Like so many of my recent projects this library builds on my [tubes][tubes]
library for handling streaming output. However I think its uses are fairly
self-explanatory, and where they aren't the
[documentation should be][tubesdocs].

*NB: I'm going to discuss some stuff that sounds scary at first but
isn't. Believe in yourself!*

The code is available in a [github repository](https://github.com/gatlin/shitter).

Type Hype
===

To begin I decided to use the excellent [http-client][httpclient] package. It
exposes a fairly low-level interface for creating HTTP requests and getting back
responses. And as such the library almost exclusively uses `ByteString`s for
moving data around. The additional [http-client-tls][httpclienttls] package
provides an easy way to handle HTTPS connections.

Because I turned out to need them in a lot of places I first wrote a type for
request parameters:

```haskell
data Param = Param ByteString ByteString
```

Pretty straightforward.

The Twitter API requires a *consumer key* and *consumer secret* for
authenticated endpoints to determine **who** is making the request. And for most
endpoints you must also supply an *access token* and an *access secret*. Some
endpoints - for instance, ones where you obtain access tokens and secrets -
don't require them. So without further ado let's define a type to hold all of
our credentials:

```haskell
data Credentials = Credentials
    { consumerKey :: ByteString
    , consumerSecret :: ByteString
    , token :: Maybe ByteString
    , tokenSecret :: Maybe ByteString
    } deriving (Show)
```

Awesome. We're going to need these just about everywhere. `http-client` keeps
track of connection pools for me using a `Manager` value. For efficiency (and,
sometimes, correct behavior) it's a good practice to create one and share it
throughout an application. Twitter might decide I have too many open connections
otherwise.

Since we will want to share credentials and connection managers throughout the
entire program we can define a read-only Twitter state type:

```haskell
data TwitterStateRO = TwitterStateRO
    { credentials :: Credentials
    , manager     :: Manager
    }
```

But wait, where exactly will we be --

IT'S OKAY EVERYONE YOU'LL BE FINE
===

```haskell
{-# LANGUAGE GeneralizedNewtypeDeriving #-}

import Control.Monad.Reader
import Control.Monad.IO.Class

{- ... -}

newtype Twitter a = Twitter (ReaderT TwitterStateRO IO a)
    deriving ( Functor
             , Applicative
             , Monad
             , MonadReader TwitterStateRO
             , MonadIO )
```

Oh, that word. Yay.

Monads are miniature command languages. Just like with a command prompt,
commands take arguments and produce output but they also have side effects on
the underlying computer.

`IO` is a language with commands that can perform I/O with the computer. Another
(defined in the `transformers` and `mtl` packages), `Reader r`, is a language
that can at any time consult a hidden value of type `r` while executing
commands.

Specifically, `Reader r` has the following function:

```haskell
ask :: Reader r r
```

When you call it, it returns the hidden `r` value you were storing. To wit:

```haskell
someReaderComputation :: Reader Int String
someReaderComputation n = do
    hiddenValue <- ask
    if (hiddenValue `mod` 2 == 0)
        then return "The number is even"
        else return "This was a stupid example Gatlin and you know it"
```

Monads can also be stacked on top of each other to combine their abilities. In
addition to `Reader r` there is `ReaderT r m`, which has a hidden value of type
`r` and sits on top of another monad `m`. By convention monads which *transform*
others have a `T` suffix.

A lot of clever bullshit has gone into the various implementations of monad
transformers but the good news is with a language extension enabled you can
automatically derive everything you need, as shown above. [^2]

Now we need a way of  evaluating `Twitter` commands with user-supplied
`Credentials` that automatically sets up and tears down a connection `Manager`:

```haskell
runTwitter :: Credentials -> Twitter a -> IO a
runTwitter creds (Twitter c) = do
    manager <- newManager tlsManagerSettings
    runReaderT c $ TwitterStateRO creds manager
```

That's the very same one demonstrated at the beginning of the
article. `runReaderT` takes expressions in the `ReaderT r m` language and
delivers values in the underlying `m` language.

How do we go about making it easy to access the `Credentials` or the `Manager`?

```haskell
getCredentials :: Twitter Credentials
getCredentials = ask >>= return . credentials

getManager :: Twitter Manager
getManager = ask >>= return . manager
```

Oh. And then by exporting `Twitter`, `runTwitter`, `getCredentials`, and
`getManager`, users of the library don't have to know how the proverbial sausage
is made. They can just use these functions.

OAuth, where are thou?
===

The OAuth implementation is actually enough to be an article all on its
own. For good reason Twitter has high and particular standards. After hours of
battling real literal actual dragons I ginned up a function `auth_header` which
produces the correct OAuth signatures and such required to authenticate with
Twitter.

Because I opted to use a custom monad which threads the credentials through it,
though, I got to write this:

```haskell
auth_header
    :: ByteString -- ^ method
    -> ByteString -- ^ url
    -> [Param] -- ^ Any extra parameters to pass
    -> Twitter ByteString
auth_header method url extras  = do
    nonce <- gen_nonce
    ts    <- timestamp >>= return . pack . show
    (Credentials key secret token token_secret) <- getCredentials
    let params = [ Param "oauth_consumer_key" key
                 , Param "oauth_nonce" nonce
                 , Param "oauth_timestamp" ts
                 , Param "oauth_token" (maybe "" id token)
                 , Param "oauth_signature_method" "HMAC-SHA1"
                 , Param "oauth_version" "1.0"
                 ]
    let sk      = signing_key secret token_secret
    let params' = param_string $ extras ++ params
    let base_string = sig_base_string params' method url
    let signature = sign sk base_string
    let with_signature = (Param "oauth_signature" signature) : params
    return $ create_header_string with_signature
```

It needs some explaining but I'd be willing to bet the average programmer from
any background could more or less follow what I'm doing there, modulo some
specifics.

Notice how cool and fly I am as I use `getCredentials`. Because of the
requirement to generate random values and get a timestamp `auth_header` had to
somehow be part of the `IO` monad anyway so this was a natural fit.

I got SERVED
===

A design goal of `Twitter` is to automatically close open connections and do as
much repetitive work as possible. I'm going to take you step-by-step through the
different pieces and show how I built up my little command language and it's
going to be really impressive because in fact I actually developed this almost
completely in reverse and spent a lot of time crying.

`http-client` provides a type `Response a` which allows you to get back response
data in any number of forms. (We'll get to `Request`s in a moment.) Regardless
of the type of the actual response payload, `Response` encapsulates other things
like the response headers, status code, etc.

One such value is a `BodyReader`, which is an alias for `IO ByteString` because
the former gives you an indication of what it's used for and the latter sounds
like a Marvel villain.

Because `IO` expressions evaluate on an as-needed basis this is actually a
clever way to prevent more data from being loaded until necessary.

I want to be able to stream incoming results using my `tubes` library,
though. Specifically I'd like to have a `Response (Source Twitter
ByteString)`. Since that's quite a handful I'll alias it:

```haskell
type ResponseStream = Response (Source Twitter ByteString)
```

The first step, then, is converting `BodyReader` to `Source Twitter ByteString`:

```haskell
from :: BodyReader -> Source Twitter ByteString
from br = Source loop where
    loop do
        bs <- liftIO br
        if null bs
            then halt
            else (yield bs) >> loop
```

Additionally `http-client` provides two functions:

* `responseOpen :: Request -> Manager -> IO (Response BodyReader)`
* `responseClose :: Response BodyReader -> IO ()`

The first essentially takes a request and a connection manager, performs the
actual HTTP request, and gives you back a `Response` ready to be evaluated. The
second explicitly closes the connection involved with the `Response`.

Since we're operating in a different monad, though, I imported these two
functions with a prefix and wrote my own:

```haskell
responseOpen :: Request -> Twitter ResponseStream
responseOpen req = do
    manager <- getManager
    response <- liftIO $ H.responseOpen req manager
    return $ fmap (from . brRead) response

responseClose :: Response a -> Twitter ()
responseClose = liftIO . H.responseClose
```

`brRead` evaluates a chunk of the unevaluated `Response` value and then passes
it along. And now I can write a function that makes requests for me and
automatically cleans up and closes connections when finished:

```haskell
makeRequest
    :: Request
    -> (ResponseStream -> Twitter a)
    -> Twitter a
makeRequest r k = do
    response <- responseOpen r
    result <- k response
    responseClose response
    return result
```

The Twitter API responds to `GET` and `POST` HTTP requests for different end
points. I wrote two functions for generating `Request` values for each type,
complete with the correct authorization headers. Here is the `GET` one:

```haskell
getRequest
    :: String -- ^ URL
    -> [Param] -- ^ Request parameters
    -> Twitter Request
getRequest url params = do
    -- convert the parameters into a query string
    let queryString = "?"++(unpack $ param_string params)
    initialRequest <- liftIO $ parseRequest $ "GET "++ url ++ queryString
    ah <- auth_header "GET" (pack url) params
    return $ initialRequest {
            requestHeaders =
                    [("Authorization", ah)
                    ,("Content-type", "multipart/form-data")
                    ,("Accept", "*/*")
                    ,("User-Agent","undershare")]
            }
```

Again, because all of this is happening inside a big happy `Twitter` monad,
merely by calling `auth_header` the credentials are passed along as a side
effect and I don't need to explicitly thread them through the whole program.

Let's twitterpate
===

With these in hand, finally, we can create some commands. First let's get the
user's home timeline, which is a collection of the most recent tweets they're
following:

```haskell
getHomeTimeline'
    :: [Param]
    -> (Status -> Source Twitter ByteString -> Twitter a)
    -> Twitter a
getHomeTimeline' params k = do
    request <- getRequest (urlRESTBase ++ "statuses/home_timeline.json") params
    makeRequest request $ \r -> k (responseStatus r) (responseBody r)

getHomeTimeline
    :: (Status -> Source Twitter ByteString -> Twitter a)
    -> Twitter a
getHomeTimeline k = getHomeTimeline' [] k
```

The first version allows you to specify any optional parameters you want; the
second just goes with the defaults. You can use this like so:

```haskell
homeTimelineExample = runTweet creds $ do
    getHomeTimeline $ \_ tweets ->
        runTube $ sample tweets
               >< map unpack -- provided by the bytestring package
               >< pour (someFileSink "out.txt")
```

Provided that you had a `someFileSink :: FilePath -> Sink Twitter String` you
could log everything into a file for later processing, and very efficiently.

For tweeting we can write something similar:

```haskell
tweet'
    :: String -- ^ tweet text
    -> [Param]
    -> Twitter Status
tweet' txt params = do
    let url = urlRESTBase ++ "statuses/update.json"
    let params' = (Param "status" (pack txt) : params)
    request <- postRequest url params'
    makeRequest request $ return . responseStatus

tweet :: String -> Twitter Status
tweet txt = tweet' txt []
```

The cool thing about my approach, though, is that Twitter's streaming endpoints
also work well. Consider the user stream, which gives you *real time* updates
for a particular user's Twitter stream. Voici:

```haskell
userStream'
    :: [Param]
    -> (Status -> Source Twitter ByteString -> Twitter a)
    -> Twitter a
userStream' params k = do
    request <- getRequest "https://userstream.twitter.com/1.1/user.json" params
    makeRequest request $ \r -> k (responseStatus r) (responseBody r)

userStream :: (Status -> Source Twitter ByteString -> Twitter a) -> Twitter a
userStream k = userStream' [] k
```

That's ... almost identical to the other non-streaming endpoint. Unless a
completely empty string is sent (no newlines, no nothing) the `Source` created
by `from` will continue supplying output until the connection is explicitly
closed. So really no extra effort is necessary to support RESTful or streaming
endpoints. Neat!

I haven't yet finished implementing commands for every single REST endpoint and
I have ideas for how to make it really easy to specify search parameters and
stream preferences, but it's a good start.

Oh and I really should provide a `Channel` for automatically decoding JSON
values. Shit this is getting long.

Closing #thoughtsandprayers
===

What is the meaning of all this, then? The monad pattern allows you to easily
thread global values through a program without having to explicitly carry them
around.

GHC provides mechanisms for automatically deriving combinations of known monads
into new ones, and by hiding this derivation behind a module if I need, for
example, to add logging with the `WriterT w m` monad or have a mutable value
with `StateT s m`, well, I can and nothing will break for the end user.

That's one hell of a run-on sentence.

And the monad pattern itself can be used to define a command language with side
effects that abstracts away tedium. Users of my library get to write

```haskell
shitpost :: Twitter ()
shitpost = runTwitter my_access_keys $ do
    status <- tweet "#RipHarambe"
    liftIO . putStrLn $ case statusCode status of
        200 -> "Shit: posted"
        _   -> "Another time, sweet prince"
```

And that's it.

[tubes]: http://hackage.haskell.org/package/tubes
[tubesdocs]: http://hackage.haskell.org/package/tubes-2.1.1.0/docs/Tubes.html
[httpclient]: http://hackage.haskell.org/package/http-client
[httpclienttls]: http://hackage.haskell.org/package/http-client-tls

[^1]: For those of you who may not be acquainted with the term, API stands for
    "Application Programming Interface" or "a way for a computer to use a
    program." It's a generic term, but most of the time I come across the term
    it means the more specific "series of HTTP endpoints a computer can make
    requests to."

[^2]: So what's with the `Applicative` and `Functor` bullshit, huh? Haskell
    should probably work on its PR but those are typeclasses which are
    pre-requisites for being a `Monad`. Should they be automatically derived?
    Probably. Oh well it doesn't cost me much to remember to include them.
