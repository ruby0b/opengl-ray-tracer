// All we do is pass the vertex location to the fragment shader
#version 150

in vec4 vertex_location_in;

out vec4 vertex_location;

void main() {
    gl_Position = vertex_location_in;
    vertex_location = vertex_location_in;
}
