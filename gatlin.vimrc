" -- Variables --
exe 'set runtimepath=~/.config/vim,/usr/share/vim/vimfiles,'.$VIMRUNTIME

" -- Functionality --

" Indentation
set autoindent
set smartindent
set preserveindent
set tabstop=4
set shiftwidth=4
set expandtab ts=4 sw=4 ai
filetype indent on
filetype plugin on

" Code folding
set foldcolumn=0
set foldmethod=indent
set foldlevel=100

" Searching
set ignorecase
set smartcase
set hlsearch
set incsearch

" Key mappings
set pastetoggle=<F3>
nmap     <silent> <Space>    za:nohlsearch<CR>

" Splitting
set splitright
set splitbelow
set diffopt=filler,vertical

" Backup
set nobackup

" Other
set scrolloff=5
set backspace=indent,eol,start

" Window title
if $TERM=='screen'
	exe 'set title titlestring=vim:%t%(\ %m%)'
	exe 'set title t_ts=]2;%t\\'
endif

" Wild menu (tab completion)
set wildmenu
set wildmode=full
set wildchar=<Tab>
cnoremap <Left> <Space><BS><Left>
cnoremap <Right> <Space><BS><Right>

" File browser
let netrw_browse_split=4

" -- Appearance --

" Text display
set t_Co=256
colorscheme koehler
syntax on
set number
set numberwidth=5
set showmatch
set linebreak
set showbreak=>
set list
set listchars=tab:>-,trail:.
"set spell
set display=lastline

" Window size
set equalalways
set textwidth=79
set winminwidth=10
set winwidth=80
set nowrap

" Status line
set laststatus=2
set statusline=[%F]\%([%M%R]%)%=[%c,%l\ of\ %L]
set showcmd
set noruler
set cursorline

" Whole window
set vb t_vb=

" mutt
au BufRead /tmp/mutt-* set tw=72

" vala
autocmd BufRead *.vala set efm=%f:%l.%c-%[%^:]%#:\ %t%[%^:]%#:\ %m
autocmd BufRead *.vapi set efm=%f:%l.%c-%[%^:]%#:\ %t%[%^:]%#:\ %m
au BufRead,BufNewFile *.vala            setfiletype vala
au BufRead,BufNewFile *.vapi            setfiletype vala

let vala_comment_strings = 1
let vala_space_errors = 1

imap <buffer> \forall ∀
imap <buffer> \to →
imap <buffer> \lambda λ
imap <buffer> \Sigma Σ
imap <buffer> \exists ∃
imap <buffer> \equiv ≡
