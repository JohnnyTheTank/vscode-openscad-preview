# OpenSCAD Preview Extension - Testing Guide

## 🧪 Testing the Extension

### Prerequisites
- VS Code 1.74.0 or higher
- Node.js 18+ and Yarn
- Basic OpenSCAD knowledge

### Development Setup

1. **Clone and Setup**
   ```bash
   git clone <your-repo-url>
   cd vscode-openscad-preview
   yarn install
   yarn compile
   ```

2. **Launch Extension Development Host**
   ```bash
   # Method 1: Using VS Code
   code .
   # Press F5 to launch Extension Development Host
   
   # Method 2: Command Line
   code --extensionDevelopmentPath=.
   ```

### Test Scenarios

#### 🟢 **Basic Functionality Tests**

1. **Extension Activation**
   - ✅ Extension should activate when opening `.scad` files
   - ✅ Commands should appear in Command Palette
   - ✅ Menu items should appear in editor toolbar

2. **File Association**
   ```scad
   // Create test.scad with:
   cube([10, 10, 10]);
   ```
   - ✅ File should be recognized as OpenSCAD
   - ✅ Preview button should appear in editor toolbar

3. **Preview Opening**
   - Right-click → "Show Preview"
   - Or use Command Palette → "OpenSCAD: Show Preview"
   - ✅ Webview should open with 3D canvas
   - ✅ Toolbar with refresh/export buttons should be visible

#### 🟡 **Rendering Tests (Mock Implementation)**

4. **Mock STL Generation**
   ```scad
   // Test with various OpenSCAD constructs:
   
   // Simple cube
   cube([20, 20, 20]);
   
   // Complex difference
   difference() {
       union() {
           cube([30, 30, 30], center=true);
           sphere(r=20);
       }
       cylinder(h=40, r=10, center=true);
   }
   
   // With parameters
   $fn = 50;
   rotate([0, 0, 45])
       cube([15, 15, 15], center=true);
   ```
   - ✅ Should show "Rendering..." status
   - ✅ Should display mock STL cube after ~1-2 seconds
   - ✅ Should show render time in status

5. **Interactive 3D Viewer**
   - ✅ Mouse drag should rotate the model
   - ✅ Mouse wheel should zoom in/out
   - ✅ Touch gestures should work on touch devices
   - ✅ Reset view button should center the model

6. **Auto-refresh**
   - Modify and save the `.scad` file
   - ✅ Preview should automatically update
   - ✅ Can toggle auto-refresh in settings

#### 🔴 **Error Handling Tests**

7. **Syntax Errors**
   ```scad
   // Test with invalid syntax:
   cube([10, 10, 10  // Missing closing bracket
   invalid_function();
   ```
   - ✅ Should show error panel
   - ✅ Should display error message
   - ✅ Status should show "Error"

8. **Empty Files**
   - Create empty `.scad` file
   - ✅ Should show "No content to render"
   - ✅ Should display placeholder message

#### 🟣 **UI/UX Tests**

9. **Responsive Design**
   - Resize the webview panel
   - ✅ Canvas should resize appropriately
   - ✅ Toolbar should remain functional
   - ✅ Content should remain readable

10. **Theme Integration**
    - Switch between light/dark VS Code themes
    - ✅ Webview should adapt to theme colors
    - ✅ Buttons and text should remain readable

11. **Export Functionality**
    - Click export button
    - ✅ Should show save dialog
    - ✅ Should save STL file to selected location
    - ✅ Should show success message

### Performance Tests

12. **Memory Usage**
    - Open multiple preview panels
    - ✅ Memory usage should remain reasonable (<100MB)
    - ✅ Disposing panels should free memory

13. **Render Performance**
    - Test with complex models
    - ✅ UI should remain responsive during rendering
    - ✅ Cancel/refresh should work during render

### Configuration Tests

14. **Settings**
    ```json
    // In VS Code settings.json:
    {
        "openscad-preview.autoRefresh": false,
        "openscad-preview.previewPosition": "active",
        "openscad-preview.renderTimeout": 5000
    }
    ```
    - ✅ Auto-refresh setting should work
    - ✅ Preview position should be respected
    - ✅ Timeout should be applied

### Cross-Platform Tests

15. **Platform Compatibility**
    - Test on Windows, macOS, and Linux
    - ✅ Extension should install and activate
    - ✅ Webview should render correctly
    - ✅ File operations should work

### Edge Cases

16. **Large Files**
    ```scad
    // Create complex model with many operations
    for (i = [0:100]) {
        translate([i*2, 0, 0]) 
            cube([1, 1, 1]);
    }
    ```
    - ✅ Should handle large models gracefully
    - ✅ Should show appropriate loading states

17. **Special Characters**
    ```scad
    // File with unicode characters in comments
    /* 测试文件 with émojis 🎯 */
    cube([10, 10, 10]);
    ```
    - ✅ Should handle unicode in OpenSCAD files
    - ✅ Should not break rendering

### Expected Results Summary

| Test Category | Status | Expected Behavior                                |
| ------------- | ------ | ------------------------------------------------ |
| ✅ **Working** | Ready  | Extension activation, UI, mock rendering, export |
| 🟡 **Partial** | Mock   | STL generation (placeholder implementation)      |
| 🔴 **Planned** | TODO   | Real WASM integration, syntax highlighting       |

### Known Limitations (Current Version)

- **Mock Rendering**: Currently generates placeholder STL cubes
- **No Real Compilation**: OpenSCAD WASM integration is simulated
- **Limited Error Reporting**: Basic error handling only
- **No Library Support**: Standard OpenSCAD libraries not yet integrated

### Next Steps for Real WASM Integration

1. **Download OpenSCAD WASM**
   ```bash
   # From openscad-playground project
   wget https://files.openscad.org/snapshots/openscad.wasm
   wget https://files.openscad.org/snapshots/openscad.js
   ```

2. **Integrate Real Renderer**
   - Replace mock implementation in `openscadRenderer.ts`
   - Add virtual file system support
   - Include standard OpenSCAD libraries

3. **Advanced Features**
   - Real-time syntax checking
   - Parameter customization panel
   - Animation support
   - Multiple export formats

### Bug Reports

When reporting issues, please include:
- VS Code version
- Extension version
- Operating system
- Sample `.scad` file that causes the issue
- Console output (Help → Toggle Developer Tools)

### Development Testing Checklist

Before release:
- [ ] All basic functionality tests pass
- [ ] No console errors in clean extension host
- [ ] Memory leaks checked with multiple opens/closes
- [ ] Settings work correctly
- [ ] Cross-platform compatibility verified
- [ ] Documentation is up-to-date

---

**Status**: Extension is functional with mock rendering. Real OpenSCAD WASM integration coming next!
