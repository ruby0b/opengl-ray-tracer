cmake_minimum_required(VERSION 3.9)

project(ray-tracer)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_VERBOSE_MAKEFILE ON)

add_compile_options(-Wall -Wextra -Wpedantic)

# help clangd find stuff
set(CMAKE_EXPORT_COMPILE_COMMANDS ON CACHE INTERNAL "")
set(CMAKE_CXX_STANDARD_INCLUDE_DIRECTORIES ${CMAKE_CXX_IMPLICIT_INCLUDE_DIRECTORIES})

# Make shader files includable in C++ code
function(make_includable input_file output_file)
    file(READ ${input_file} content)
    set(delim "===")
    set(content "/* GENERATED FROM ${input_file} */\nR\"${delim}(\n${content})${delim}\"")
    file(WRITE ${output_file} "${content}")
endfunction(make_includable)

make_includable(shaders/rt.frag src/generated/rt.frag)
make_includable(shaders/rt.vert src/generated/rt.vert)

set(OpenGL_GL_PREFERENCE GLVND)
find_package(OpenGL REQUIRED)
find_package(GLEW REQUIRED)
find_package(glfw3 REQUIRED)

add_executable(ray-tracer src/main.cpp)
target_link_libraries(ray-tracer GL GLEW glfw)

install(TARGETS ray-tracer DESTINATION bin)