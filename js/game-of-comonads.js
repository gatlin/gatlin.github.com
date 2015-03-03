(function() {
    'use strict';
    var element = document.getElementById('game-of-comonads'),
        canvas = element.getContext('2d'),
        size = 100,
        scale = 8,
        setup,
        main;

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

    function makeBoard(arry, x, y, dx, dy) {
        var i, j;
        var board = [];
        for (i = 0; i < size; i++) {
            board[i] = [];
            for (j = 0; j < size; j++) {
                board[i][j] = false;
            }
        }

        for (j = 0; j < y; j++) {
            for (i = 0; i < x; i++) {
                board[i+dx][j+dy] = arry[j][i];
            }
        }

        return board;
    }

    function wutBoard() {
        return new IO(function() {
            var board = makeBoard(
                    [[true, true, true],
                     [false, false, true],
                     [true, false, false],
                     [true, false, true]],
                     3, 4, 70, 50);
            return board;
        });
    }

    function pulsar() {
        return new IO(function() {
            var board = makeBoard(
    [ [ false, false, true, true, true, false, false, false, true, true, true, false, false ]
    , [ false, false, false, false, false, false, false, false, false, false, false, false, false ]
    , [ true, false, false, false, false, true, false, true, false, false, false, false, true ]
    , [ true, false, false, false, false, true, false, true, false, false, false, false, true ]
    , [ true, false, false, false, false, true, false, true, false, false, false, false, true ]
    , [ false, false, true, true, true, false, false, false, true, true, true, false, false ]
    , [ false, false, false, false, false, false, false, false, false, false, false, false, false ]
    , [ false, false, true, true, true, false, false, false, true, true, true, false, false ]
    , [ true, false, false, false, false, true, false, true, false, false, false, false, true ]
    , [ true, false, false, false, false, true, false, true, false, false, false, false, true ]
    , [ true, false, false, false, false, true, false, true, false, false, false, false, true ]
    , [ false, false, false, false, false, false, false, false, false, false, false, false, false ]
    , [ false, false, true, true, true, false, false, false, true, true, true, false, false ] ],
                     13, 13, 44, 44);
            return board;
        });
    }

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

    main = setup.chain(wutBoard).chain(loop);

    // Perform effects!
    main.unsafePerformIO();
})();
