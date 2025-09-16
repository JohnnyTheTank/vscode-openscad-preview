// Full-Screen 3D Preview Test
// Designed to showcase the immersive full-width/height viewing experience
// With OFF format and professional GLB materials + lighting

// Complex architectural model perfect for full-screen viewing
module tower() {
    // Base platform
    translate([0, 0, 1])
    cylinder(h=2, r=25, center=true);
    
    // Main tower structure
    for(level = [0:4]) {
        translate([0, 0, 4 + level * 8])
        difference() {
            cylinder(h=8, r=20 - level*2, center=true);
            
            // Windows around each level
            for(angle = [0:45:315]) {
                rotate([0, 0, angle])
                translate([18 - level*2, 0, 0])
                cube([4, 6, 6], center=true);
            }
        }
        
        // Decorative rings
        translate([0, 0, 8 + level * 8])
        torus(22 - level*2, 1);
    }
    
    // Crown/roof
    translate([0, 0, 42])
    cylinder(h=8, r1=8, r2=0, center=true);
    
    // Decorative spires
    for(angle = [0:90:270]) {
        rotate([0, 0, angle])
        translate([12, 0, 46])
        cylinder(h=6, r=0.5, center=true);
    }
}

// Custom torus module for decorative elements
module torus(major_radius, minor_radius) {
    rotate_extrude()
    translate([major_radius, 0, 0])
    circle(r=minor_radius);
}

// Create the main model
tower();

// Add surrounding elements for scale
for(i = [0:7]) {
    angle = i * 45;
    distance = 40;
    
    rotate([0, 0, angle])
    translate([distance, 0, 1.5])
    cube([3, 3, 3], center=true);
}
