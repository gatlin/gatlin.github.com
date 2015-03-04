(function() {
    'use strict';
    var element = document.getElementById('game-of-comonads'),
        canvas = element.getContext('2d'),
        size = 100,
        scale = 8,
        setup,
        main;
    var currentTimeout = null;

    // Helpers
    function identity(x) {
        return x;
    }

    function map(as, f) {
        var r = [], i;
        for(i = 0; i < as.length; i++) {
            r.push(f(as[i]));
        }
        return r;
    }

    function filter(as, f) {
        var r = [], i;
        for(i = 0; i < as.length; i++) {
            if(!f(as[i])) {
                continue;
            }
            r.push(as[i]);
        }
        return r;
    }

    // Comonadic Game of Life logic
    function Pos(x, y) {
        this.x = x;
        this.y = y;
    }

    function Pointer(board, pos) {
        this.board = board;
        this.pos = pos;
    }
    Pointer.prototype.updatePos = function(pos) {
        return new Pointer(this.board, pos);
    };
    Pointer.prototype.extract = function() {
        return this.board[this.pos.x][this.pos.y];
    };
    Pointer.prototype.extend = function(f) {
        var board = [], x, y;
        for(x = 0; x < this.board.length; x++) {
            board[x] = [];
            for(y = 0; y < this.board[x].length; y++) {
                board[x][y] = f(new Pointer(this.board, new Pos(x, y)));
            }
        }
        return new Pointer(board, this.pos);
    };

    function inBounds(pos) {
        return pos.x >= 0 && pos.y >= 0 && pos.x < size && pos.y < size;
    }

    function pointerNeighbours(pointer) {
        var offsets = [new Pos(-1, -1), new Pos(-1, 0), new Pos(-1, 1), new Pos(0, -1), new Pos(0, 1), new Pos(1, -1), new Pos(1, 0), new Pos(1, 1)],
            positions = filter(map(offsets, function(offset) {
                return new Pos(pointer.pos.x + offset.x, pointer.pos.y + offset.y);
            }), inBounds);

        return map(positions, function(pos) {
            return pointer.updatePos(pos).extract();
        });
    }

    function liveNeighbours(pointer) {
        return filter(pointerNeighbours(pointer), identity).length;
    }

    function rules(pointer) {
        var c = pointer.extract(),
            n = liveNeighbours(pointer);

        return c && (n < 2 || n > 3) ? false : (c && n == 2) || n == 3 || c;
    }

    function step(board) {
        return new Pointer(board, new Pos(0, 0)).extend(rules).board;
    }

    // IO monad and drawing
    function IO(unsafePerformIO) {
        this.unsafePerformIO = unsafePerformIO;
    }
    IO.of = function(o) {
        return new IO(function() {
            return o;
        });
    };
    IO.prototype.chain = function(f) {
        var io = this;
        return new IO(function() {
            return f(io.unsafePerformIO()).unsafePerformIO();
        });
    };
    IO.prototype.fork = function() {
        var io = this;
        return new IO(function() {
            currentTimeout =
                setTimeout(function() {
                    io.unsafePerformIO();
                }, 100);
        });
    };

    setup = new IO(function() {
        element.width = size * scale;
        element.height = size * scale;
        canvas.scale(scale, scale);
    });

    function generateBoard() {
        return new IO(function() {
            var board = [], x, y;
            for(x = 0; x < size; x++) {
                board[x] = [];
                for(y = 0; y < size; y++) {
                    board[x][y] = Math.random() > 0.5;
                }
            }
            return board;
        });
    }

    function makeBoard(arry) {
        var x = arry[0].length;
        var y = arry.length;
        var dx = (size/2) - x;
        var dy = (size/2) - y;
        var i, j;
        var board = [];
        for (i = 0; i < size; i++) {
            board[i] = [];
            for (j = 0; j < size; j++) {
                board[i][j] = false;
            }
        }

        var int2bool = function(i) {
            return i == 1;
        }

        for (j = 0; j < y; j++) {
            for (i = 0; i < x; i++) {
                board[i+dx][j+dy] = int2bool(arry[j][i]);
            }
        }

        return board;
    }

    var experiments = [

        function () {
            return new IO(function() {
                var board = makeBoard(
                        [[1, 1, 1],
                         [0, 0, 1],
                         [1, 0, 0],
                         [1, 0, 1]]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 1, 1, 1, 0, 0, 1, 1, 1, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 1, 1, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 1, 1, 1, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 1, 1, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 1, 1, 1, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 1, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 1, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 1, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 1, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 1, 1, 1, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 1, 0, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 1, 0, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 1, 0, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 1, 0, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 1, 0, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 1, 0, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 1, 1, 1 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 1, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 1, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 1, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 1, 1, 0, 1, 0, 1, 1, 1, 0, 0 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 1, 1, 0, 1 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 1, 0, 0, 0, 0, 1, 1, 1, 0, 0 ]
                    , [ 1, 1, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
        [ [ 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0 ]
        , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
        , [ 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1 ]
        , [ 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1 ]
        , [ 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1 ]
        , [ 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0 ]
        , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
        , [ 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0 ]
        , [ 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1 ]
        , [ 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1 ]
        , [ 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1 ]
        , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
        , [ 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 1, 0, 0, 0 ]
                    , [ 1, 1, 0, 1, 0, 0, 1, 0, 1, 1 ]
                    , [ 0, 1, 0, 1, 0, 0, 1, 0, 1, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 1, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },
        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 1, 1, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 1, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 1, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 1, 1, 0, 1, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },
        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 1, 0, 0, 1, 0, 0, 1, 0, 0, 0 ]
                    , [ 1, 0, 1, 1, 0, 1, 1, 0, 0, 0 ]
                    , [ 1, 0, 0, 1, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        },
        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 1, 0, 0, 0, 0, 0, 1, 0, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 0, 1, 0, 0 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);

                return board;
            });
        },

        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 1, 0, 0, 0, 0, 0, 1, 0, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 0, 1, 0, 0 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 0, 1, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);

                return board;
            });
        },
        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 0, 0, 0, 0, 0, 1, 0, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 0, 1, 0, 0 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 0, 1, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 1, 0, 1, 0, 1, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 0, 0, 0, 0, 0, 1, 0, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 0, 1, 0, 0 ]
                    , [ 0, 1, 0, 0, 1, 0, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 1, 1, 1, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ]
                    , [ 0, 1, 0, 1, 1, 1, 0, 1, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 1, 0, 1, 0, 1, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);

                return board;
            });
        },
        function () {
            return new IO(function() {
                var board = makeBoard(
                    [ [ 0, 1, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 1, 1, 1, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 1, 0, 1, 0, 0 ]
                    , [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ]);
                return board;
            });
        }

    ];

    function drawBoard(board) {
        return new IO(function() {
            var x, y;
            for(x = 0; x < board.length; x++) {
                for(y = 0; y < board[x].length; y++) {
                    if(board[x][y]) {
                        canvas.fillRect(x, y, 5, 5);
                    } else {
                        canvas.clearRect(x, y, 5, 5);
                    }
                }
            }
        });
    }

    function loop(board) {
        return drawBoard(board).chain(function() {
            return loop(step(board)).fork();
        });
    }

    var main;

    function start(n) {
        main = setup.chain(experiments[n]).chain(loop);
        main.unsafePerformIO();
    }

    $('select[name=picker]').on('change',function() {
        var picked = $(this).val();
        console.log(picked);
        if (picked == "Choose an experiment") {
            return;
        }
        if (currentTimeout) {
            clearTimeout(currentTimeout);
        }
        start(parseInt(picked));
    });

})();
