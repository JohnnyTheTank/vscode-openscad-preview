// STLLoader wrapper for global THREE.js usage
// This avoids ES module import issues

class STLLoader {
    parse(data) {
        // Convert ArrayBuffer to string for parsing
        let string = '';
        const dataView = new DataView(data);

        // Check if binary STL
        const header = new Uint8Array(data, 0, 80);
        const headerString = new TextDecoder().decode(header);

        if (headerString.indexOf('solid') === 0 && headerString.indexOf('\n') !== -1) {
            // ASCII STL
            string = new TextDecoder().decode(new Uint8Array(data));
        } else {
            // Binary STL
            return this.parseBinary(data);
        }

        return this.parseASCII(string);
    }

    parseASCII(data) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];

        const lines = data.split('\n');
        let inFacet = false;
        let normalVector = null;
        let vertexCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('facet normal')) {
                inFacet = true;
                const parts = line.split(/\s+/);
                normalVector = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])];
                vertexCount = 0;
            } else if (line.startsWith('vertex') && inFacet) {
                const parts = line.split(/\s+/);
                vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
                if (normalVector) {
                    normals.push(normalVector[0], normalVector[1], normalVector[2]);
                }
                vertexCount++;
            } else if (line === 'endfacet') {
                inFacet = false;
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

        return geometry;
    }

    parseBinary(data) {
        const geometry = new THREE.BufferGeometry();
        const dataView = new DataView(data);

        // Skip 80-byte header
        const triangles = dataView.getUint32(80, true);

        const vertices = [];
        const normals = [];

        let offset = 84;

        for (let i = 0; i < triangles; i++) {
            // Normal vector (3 floats)
            const nx = dataView.getFloat32(offset, true);
            const ny = dataView.getFloat32(offset + 4, true);
            const nz = dataView.getFloat32(offset + 8, true);
            offset += 12;

            // Three vertices (9 floats)
            for (let j = 0; j < 3; j++) {
                const x = dataView.getFloat32(offset, true);
                const y = dataView.getFloat32(offset + 4, true);
                const z = dataView.getFloat32(offset + 8, true);
                offset += 12;

                vertices.push(x, y, z);
                normals.push(nx, ny, nz);
            }

            // Skip attribute byte count (2 bytes)
            offset += 2;
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

        return geometry;
    }
}

// Export for global use
window.STLLoader = STLLoader;
