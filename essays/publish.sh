#!/bin/bash

###
# Generate the documentation from sources
###

# if pandoc is present, we will generate the HTML
if hash pandoc 2>/dev/null; then

    ###
    # Loop over each file and process according to its extension
    for f in $(ls ./); do
        filename=`basename $f`
        extension="${filename##*.}"
        filename="${filename%.*}"
        out=$(echo $filename | tr '[:upper:]' '[:lower:]')
        ###
        # If the extension is Literate Haskell, process as such
        if [ $extension = "lhs" ]; then
            pandoc -s -t html5 -f markdown+lhs+yaml_metadata_block \
            --template template.lhs.html \
            -o ./$out.html $f
        ###
        # If the extension is plain markdown, process plain markdown
        elif [ $extension = "md" ]; then
            pandoc -s -t html5 -f markdown+yaml_metadata_block \
            --template ./template.md.html \
            -o ./$out.html $f
        else
            echo "File $f: not a supported format."
        fi
    done
else
    echo "Install pandoc to generate the site."
    exit 0
fi
