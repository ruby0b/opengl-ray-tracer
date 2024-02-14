/* GENERATED FROM shaders/rt.frag */
R"===(
// Ray tracer as a GLSL fragment shader
#version 150

in vec4 vertex_location;

out vec4 fragment_color;

/*
 * TYPES
 */
struct Ray {
    vec3 o; // origin
    vec3 d; // direction
};

struct Material {
    vec3 diffuse;
    float specular;
    bool mirror;
};

struct HitData {
    float t;
    vec3 pos;
    vec3 normal;
    Material mat;
};

struct Sphere {
    vec3 c;  // center
    float r; // radius
    Material mat;
};

struct Triangle {
    vec3 a;
    vec3 b;
    vec3 c;
    Material mat;
};

struct Plane {
    vec3 normal;
    float dist; // distance from origin in the direction of the normal
    Material mat;
};

// axes‐aligned‐box represented as 3 pairs of parallel planes
struct Box {
    vec3 n1;
    vec3 n2;
    vec3 n3;
    vec3 planes1;
    vec3 planes2;
    Material mat;
};

struct BoxHit {
    float t;
    vec3 normal; // surface normal, depends on which pair of planes was hit
};

struct Light {
    vec3 pos;   // position
    vec3 color; // color
};

/*
 * CONSTANTS (the scene-related constants should really be passed in as uniform vars)
 */
const vec3 v0 = vec3(0, 0, 0);
const vec3 v1 = vec3(1, 1, 1);

const vec3 COL_RED = vec3(1.0, .25, .25);
const vec3 COL_VIOLET = vec3(.54, .17, .89);
const vec3 COL_BROWN = vec3(.4, .3, .3);
const vec3 COL_GREEN = vec3(.1, .8, .1);
const vec3 COL_BLUE = vec3(.5, .5, 1.0);

const Material MAT_ZERO = Material(v0, 0, false);
const Material MAT_VIOLET = Material(COL_VIOLET, 1, false);
const Material MAT_RED = Material(COL_RED, 1, false);
const Material MAT_GREEN = Material(COL_GREEN, .5, false);
const Material MAT_WALL = Material(vec3(197, 194, 199) / 255, .1, false);
const Material MAT_MIRROR = Material(v0, 0, true);
const Material MAT_PYRAMID = MAT_GREEN;

const float MIN_RAY_T = 0.0001;
const float MAX_RAY_T = 1000.0;
const int RAY_PATH_LENGTH = 20;

const vec3 AMBIENT_LIGHT = 0.05 * v1;
const float PHONG_EXPONENT = 50.0;

const vec3 CAMERA = vec3(0.0, 0.0, 2.0);

const int LIGHT_COUNT = 1;
const Light LIGHTS[LIGHT_COUNT] = Light[]( //
    Light(vec3(0, 15, -10), v1)            //
);

// Put a mirror plane in the back of the scene
const int PLANE_COUNT = 6;
const Plane PLANES[PLANE_COUNT] = Plane[]( //
    Plane(vec3(0, 0, -1), -5, MAT_WALL),   // near plane
    Plane(vec3(0, 0, 1), -50, MAT_WALL),   // far plane
    Plane(vec3(-1, 0, 0), -50, MAT_WALL),  // right plane
    Plane(vec3(1, 0, 0), -50, MAT_WALL),   // left plane
    Plane(vec3(0, -1, 0), -50, MAT_WALL),  // top plane
    Plane(vec3(0, 1, 0), -50, MAT_MIRROR)  // bottom plane
);

const int SPHERE_COUNT = 4;
const Sphere SPHERES[SPHERE_COUNT] = Sphere[](
    // violet sphere
    Sphere(vec3(-25, -25, -20), 10, MAT_VIOLET), //
    // mirror sphere
    Sphere(vec3(+30, -30, -20), 20, MAT_MIRROR), //
    Sphere(vec3(-30, +30, -25), 20, MAT_MIRROR), //
    // red sphere
    Sphere(vec3(+20, +20, -10), 10, MAT_RED) //
);

// Make a pyramid out of 4 triangles (equilateral triangle base)
const vec3 PYR_OFFSET = vec3(0, -40, -30);
const float PYR_LENGTH = 20;
const float PYR_HEIGHT = 10;
const vec3 PYR_0 = vec3(PYR_OFFSET.x - PYR_LENGTH / 2, PYR_OFFSET.y, PYR_OFFSET.z);                         //
const vec3 PYR_1 = vec3(PYR_OFFSET.x + PYR_LENGTH / 2, PYR_OFFSET.y, PYR_OFFSET.z);                         //
const vec3 PYR_2 = vec3(PYR_OFFSET.x, PYR_OFFSET.y, PYR_OFFSET.z - (sqrt(3) * abs(PYR_0.x - PYR_1.x) / 2)); //
const vec3 PYR_3 = vec3(PYR_OFFSET.x, PYR_OFFSET.y + PYR_HEIGHT, PYR_1.z + ((PYR_2.z - PYR_1.z) / 2));      // top

const int TRIANGLE_COUNT = 4;
const Triangle TRIANGLES[TRIANGLE_COUNT] = Triangle[](
    Triangle(PYR_0, PYR_1, PYR_2, MAT_PYRAMID), Triangle(PYR_0, PYR_1, PYR_3, MAT_PYRAMID),
    Triangle(PYR_0, PYR_2, PYR_3, MAT_PYRAMID), Triangle(PYR_1, PYR_2, PYR_3, MAT_PYRAMID)
);

/*
 * FUNCTIONS
 */
vec3 ray_point(Ray ray, float t) { return ray.o + (ray.d * t); }

float sphere_hit(Ray ray, Sphere sphere) {
    vec3 m = sphere.c - ray.o;
    float m_dot_d = dot(m, ray.d);
    float sqrt_term = (m_dot_d * m_dot_d) + (sphere.r * sphere.r) - dot(m, m);
    if (sqrt_term < 0.0) return -1.0; // no intersection
    float sqrt_ = sqrt(sqrt_term);
    float t1 = m_dot_d - sqrt_;
    float t2 = m_dot_d + sqrt_;
    if (t1 > MIN_RAY_T) return t1; // t1 is closer
    return t2;                     // t1 is behind us (or both are behind us)
}

float triangle_hit(Ray ray, Triangle triangle) {
    vec3 u = triangle.b - triangle.a;
    vec3 v = triangle.c - triangle.a;
    vec3 w = ray.o - triangle.a;
    vec3 d_cross_v = cross(ray.d, v);
    vec3 w_cross_u = cross(w, u);
    float denominator = dot(d_cross_v, u);
    float t = dot(w_cross_u, v) / denominator;
    float r = dot(d_cross_v, w) / denominator;
    float s = dot(w_cross_u, ray.d) / denominator;
    if (r < 0.0 || s < 0.0 || r + s > 1.0) return -1.0; // no intersection
    return t;
}

float plane_hit(Ray ray, Plane plane) {
    float denominator = dot(ray.d, plane.normal);
    if (denominator == 0.0) return -1.0; // no intersection
    vec3 p0 = plane.normal * plane.dist;
    return dot(p0 - ray.o, plane.normal) / denominator;
}

HitData find_intersection(Ray ray) {
    HitData hit = HitData(MAX_RAY_T, v0, v0, MAT_ZERO);
    for (int i = 0; i < SPHERE_COUNT; i++) {
        Sphere sphere = SPHERES[i];
        float t = sphere_hit(ray, sphere);
        if (t >= MIN_RAY_T && t < hit.t) {
            vec3 pos = ray_point(ray, t);
            hit = HitData(t, pos, normalize(pos - sphere.c), sphere.mat);
        }
    }
    for (int i = 0; i < TRIANGLE_COUNT; i++) {
        Triangle triangle = TRIANGLES[i];
        float t = triangle_hit(ray, triangle);
        if (t >= MIN_RAY_T && t < hit.t) {
            // cross product of two sides of the triangle
            vec3 normal = normalize(cross(triangle.b - triangle.a, triangle.c - triangle.a));
            hit = HitData(t, ray_point(ray, t), normal, triangle.mat);
        }
    }
    for (int i = 0; i < PLANE_COUNT; i++) {
        Plane plane = PLANES[i];
        float t = plane_hit(ray, plane);
        if (t >= MIN_RAY_T && t < hit.t) {
            hit = HitData(t, ray_point(ray, t), plane.normal, plane.mat);
        }
    }
    return hit;
}

// Phong reflection model
vec3 shade(HitData hit, vec3 ray_d) {
    vec3 I = AMBIENT_LIGHT * hit.mat.diffuse;
    for (int i = 0; i < LIGHT_COUNT; i++) {
        Light light = LIGHTS[i];
        vec3 L = light.pos - hit.pos;
        float L_length = length(L);
        L /= L_length;

        // Cast a shadow ray for shadow attenuation (only hard shadows for now)
        Ray shadow_ray = Ray(hit.pos, L);
        HitData shadow_hit = find_intersection(shadow_ray);
        float shadow_attenuation = 1.0;
        if (shadow_hit.t < L_length) shadow_attenuation = 0.0; // we're in shadow

        // Diffuse reflection (Lambertian)
        I += hit.mat.diffuse * light.color * max(0.0, dot(hit.normal, L)) * shadow_attenuation;

        // Specular reflection (Phong)
        vec3 R = reflect(-L, hit.normal);
        I += hit.mat.specular * light.color * pow(max(0.0, dot(R, -ray_d)), PHONG_EXPONENT) * shadow_attenuation;
    }
    return I;
}

void main() {
    Ray ray =
        Ray(vec3(vertex_location.xy * 50, 0),       //
            normalize(vertex_location.xyz - CAMERA) // perspective projection
            // vec3(0.0, 0.0, -1.0)                 // orthographic projection
        );

    vec3 color = v0;

    for (int bounces = 0; bounces < RAY_PATH_LENGTH; bounces++) {
        HitData hit = find_intersection(ray);
        if (hit.t == MAX_RAY_T) break; // no intersection with anything, stop

        color += shade(hit, ray.d);

        if (!hit.mat.mirror) break; // stop reflecting rays if not a mirror
        ray = Ray(hit.pos, reflect(ray.d, hit.normal));
    }

    fragment_color = vec4(color, 1.0);
}
)==="