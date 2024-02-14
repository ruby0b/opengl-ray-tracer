#!/usr/bin/env sh

out=src/generated
inp=shaders
delim='==='

mkdir -p "$out"

for f in "$inp"/*; do
    name=$(basename "$f")
    echo "Writing $f to $out/$name"
    printf "/* GENERATED FROM %s */\nR\"%s(\n" "$f" "$delim" > "${out}/$name"
    cat "$f" >> "${out}/$name"
    printf ")%s\"" "$delim" >> "${out}/$name"
done
