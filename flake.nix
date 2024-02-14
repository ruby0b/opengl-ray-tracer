{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.11";

  outputs = { self, nixpkgs }:
    let
      forAllSystems = function: nixpkgs.lib.genAttrs
        [
          "x86_64-linux"
          "aarch64-linux"
          "x86_64-darwin"
          "aarch64-darwin"
        ]
        (system: function (import nixpkgs { inherit system; }));
    in
    {
      packages = forAllSystems (pkgs: {
        default = pkgs.stdenv.mkDerivation {
          name = "ray-tracer";
          nativeBuildInputs = with pkgs; [ cmake ];
          buildInputs = with pkgs; [ glew glfw ];
          buildPhase = ''
            cmake -B build -S $src
            cmake --build build
          '';
          installPhase = ''
            mkdir -p $out/bin
            cp build/ray-tracer $out/bin/
          '';
          src = ./.;
          meta.mainProgram = "ray-tracer";
        };
      });
    };
}
