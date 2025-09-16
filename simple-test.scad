// Simple OpenSCAD test file
cube([10, 10, 10]);

translate([15, 0, 0]) {
    sphere(r=5, $fn=50);
}

difference() {
    cube([20, 20, 5], center=true);
    cylinder(h=10, r=3, center=true, $fn=30);
}
