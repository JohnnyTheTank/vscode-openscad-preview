// Difference operation test
$fn = 32;

// Cube with cylindrical hole
difference() {
    // Outer cube
    cube([30, 30, 30], center=true);
    
    // Inner cylinder (hole)
    cylinder(h=35, r=8, center=true);
    
    // Side holes
    rotate([0, 90, 0])
        cylinder(h=35, r=5, center=true);
    
    rotate([90, 0, 0])
        cylinder(h=35, r=5, center=true);
}

// This demonstrates the enhanced STL generation
// for complex boolean operations
