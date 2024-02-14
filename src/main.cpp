#include <GL/glew.h>
#include <GLFW/glfw3.h>

#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <variant>
#include <vector>

using namespace std;
using namespace std::filesystem;

using ShaderSource = variant<path, string>;

const auto dynamic_vert = path("shaders/rt.vert");
const auto dynamic_frag = path("shaders/rt.frag");

const auto static_vert = string(
#include "generated/rt.vert"
);
const auto static_frag = string(
#include "generated/rt.frag"
);

struct my_error : runtime_error {
    using runtime_error::runtime_error;
};

string read_file(const path &file) {
    if (!exists(file)) throw my_error("File not found: " + file.string());
    ifstream t(file);
    stringstream buffer;
    buffer << t.rdbuf();
    return buffer.str();
}

string read_shader_source(const ShaderSource &source) {
    // no pattern matching :(
    return holds_alternative<string>(source) ? get<string>(source) : read_file(get<path>(source));
}

// RAII wrappers
struct Shader {
    const GLuint id;
    Shader(const GLenum &type, const string &source, const string &label) : id(glCreateShader(type)) {
        if (id == 0) throw my_error("Failed to create shader");

        const auto cstr = source.c_str();
        glShaderSource(id, 1, &cstr, NULL);
        glCompileShader(id);

        int status = 0;
        glGetShaderiv(id, GL_COMPILE_STATUS, &status);
        if (status == GL_TRUE) return;

        int info_log_len = 0;
        glGetShaderiv(id, GL_INFO_LOG_LENGTH, &info_log_len);
        stringstream err;
        err << "Failed to compile shader [" + label + "]";
        if (info_log_len > 0) {
            vector<GLchar> info_log(info_log_len);
            glGetShaderInfoLog(id, info_log_len, nullptr, info_log.data());
            err << ":\n" << info_log.data();
        }
        throw my_error(err.str());
    }
    ~Shader() { glDeleteShader(id); }
};

struct ShaderProgram {
    const GLuint id;
    ShaderProgram(const string &vert, const string &frag) : id(glCreateProgram()) {
        if (id == 0) throw my_error("Failed to create shader program");

        const auto vs = Shader(GL_VERTEX_SHADER, vert, "Vertex");
        const auto fs = Shader(GL_FRAGMENT_SHADER, frag, "Fragment");

        glAttachShader(id, vs.id);
        glAttachShader(id, fs.id);
        glLinkProgram(id);

        int status = 0;
        glGetProgramiv(id, GL_LINK_STATUS, &status);
        if (status == GL_TRUE) return;

        int info_log_len = 0;
        glGetProgramiv(id, GL_INFO_LOG_LENGTH, &info_log_len);
        stringstream err;
        err << "Failed to link shader program";
        if (info_log_len > 0) {
            vector<GLchar> info_log(info_log_len);
            glGetProgramInfoLog(id, info_log_len, nullptr, info_log.data());
            err << ":\n" << info_log.data();
        }
        throw my_error(err.str());
    }
    ~ShaderProgram() { glDeleteProgram(id); }
};

struct GLFW {
    GLFW() {
        if (!glfwInit()) throw my_error("Failed to initialize GLFW");
    }
    ~GLFW() { glfwTerminate(); }
};

int main(int argc, char *argv[]) try {
    // Parse CLI args
    auto enable_reload = false;
    auto show_fps = false;
    auto window_size = 720;
    for (int i = 1; i < argc; i++) {
        auto arg = string(argv[i]);
        if (arg == "-h" || arg == "--help") {
            cerr << "Usage: " << argv[0] << " [--reload] [--fps] [--size N]\n"
                 << "  --reload: Enable hot-loading of shaders from " << dynamic_frag << " and " << dynamic_vert << "\n"
                 << "  --fps: Print FPS to stderr\n"
                 << "  --size N: Set window size to NxN (default: 720)\n"
                 << "  --help: Print this message" << endl;
            return 0;
        }
        if (arg == "--reload") enable_reload = true;
        if (arg == "--fps") show_fps = true;
        if (arg == "--size") window_size = stoi(argv[++i]);
    }
    if (window_size <= 0) throw my_error("Invalid window size: " + to_string(window_size));

    const auto reload_time = 2.0;
    if (enable_reload) cerr << "Auto-reload enabled" << endl;
    const auto vert_src = enable_reload ? ShaderSource(dynamic_vert) : ShaderSource(static_vert);
    const auto frag_src = enable_reload ? ShaderSource(dynamic_frag) : ShaderSource(static_frag);

    // Logging
    cerr << "Starting GLFW " << glfwGetVersionString() << endl;
    glfwSetErrorCallback([](int error, const char *description) {
        cerr << "GLFW ERROR " << error << ": " << description << endl;
    });

    // Initialize GLFW window
    auto glfw = GLFW();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    auto window = glfwCreateWindow(window_size, window_size, "ray-tracer", nullptr, nullptr);
    if (!window) throw my_error("Failed to create GLFW window");
    glfwMakeContextCurrent(window);

    // Initialize GLEW
    glewInit();

    // Print OpenGL versions
    cerr << "Renderer: " << glGetString(GL_RENDERER) << endl;
    cerr << "OpenGL version supported: " << glGetString(GL_VERSION) << endl;

    // Create a viewport-sized rectangle with 2 triangles
    float points[] = {
        -1, 1,  0, // top left
        1,  1,  0, // top right
        -1, -1, 0, // bottom left

        1,  1,  0, // top right
        1,  -1, 0, // bottom right
        -1, -1, 0, // bottom left
    };

    GLuint vbo = 0;
    glGenBuffers(1, &vbo);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, size(points) * sizeof(float), points, GL_STATIC_DRAW);

    GLuint vao = 0;
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);
    glEnableVertexAttribArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 0, NULL);

    // Create shaders
    auto vert = read_shader_source(vert_src);
    auto frag = read_shader_source(frag_src);
    auto program = make_unique<ShaderProgram>(vert, frag);

    auto old = glfwGetTime();
    auto frames = 0u;
    auto frames_timer = 1.0;
    auto reload_timer = reload_time;
    while (!glfwWindowShouldClose(window)) {
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glUseProgram(program->id);
        glBindVertexArray(vao);
        // Draw points from the currently bound VAO with current in-use shader
        glDrawArrays(GL_TRIANGLES, 0, size(points) / 3);

        glfwPollEvents();
        auto now = glfwGetTime();
        auto delta = now - old;
        old = now;

        frames++;
        frames_timer -= delta;
        if (show_fps && frames_timer <= 0) {
            cerr << "FPS: " << frames << endl;
            frames = 0;
            frames_timer = 1;
        }

        reload_timer -= delta;
        if (enable_reload && reload_timer <= 0) {
            reload_timer = reload_time;
            try {
                const auto new_vert = read_shader_source(vert_src);
                const auto new_frag = read_shader_source(frag_src);
                if (new_vert != vert || new_frag != frag) {
                    vert = new_vert;
                    frag = new_frag;
                    program = make_unique<ShaderProgram>(vert, frag);
                    cerr << "Reload succeeded (" << now << ")" << endl;
                }
            } catch (const my_error &e) {
                cerr << "Reload failed (" << now << ")\n" << e.what() << endl;
            }
        }

        glfwSwapBuffers(window);
    }

    return 0;
} catch (const my_error &e) {
    cerr << "Error: " << e.what() << endl;
    return 1;
}