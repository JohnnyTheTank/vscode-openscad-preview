// OpenSCAD Preview Extension Test File
// This file tests various OpenSCAD features

$fn = 50;  // Smooth curves

// Test 1: Simple cube
// cube([10, 10, 10]);

// Test 2: Complex difference operation
difference() {
    union() {
        cube([20, 20, 20], center=true);
        sphere(r=15);
    }
    cylinder(h=30, r=8, center=true);
}

// Test 3: Uncomment to test other shapes
// sphere(r=12);
// cylinder(h=20, r=8, center=true);

// Test 4: More complex model
/*
for (i = [0:8]) {
    rotate([0, 0, i*45])
        translate([20, 0, 0])
            cube([5, 5, 5], center=true);
}
*/
