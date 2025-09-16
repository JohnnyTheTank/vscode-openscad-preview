// Complex OpenSCAD model for testing
$fn = 60;

// Create a decorative vase-like object
difference() {
    // Outer shape
    union() {
        // Base cylinder
        cylinder(h=30, r1=15, r2=8);
        // Decorative ring
        translate([0, 0, 20])
            torus(12, 2);
    }
    
    // Inner hollow
    translate([0, 0, 2])
        cylinder(h=32, r1=12, r2=6);
    
    // Decorative holes
    for (i = [0:7]) {
        rotate([0, 0, i*45])
            translate([10, 0, 15])
                sphere(r=2);
    }
}

// Helper function for torus (if not built-in)
module torus(major_radius, minor_radius) {
    rotate_extrude()
        translate([major_radius, 0, 0])
            circle(r=minor_radius);
}
