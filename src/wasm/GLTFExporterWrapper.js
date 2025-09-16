// GLTFExporter wrapper for global THREE.js usage
// Simplified version that exports basic geometry to GLB

class GLTFExporter {
    parse(scene, onCompleted, options = {}) {
        try {
            const binary = options.binary !== false;

            // Create basic glTF structure
            const gltf = {
                asset: {
                    version: "2.0",
                    generator: "OpenSCAD Preview Extension"
                },
                scenes: [{ nodes: [0] }],
                scene: 0,
                nodes: [],
                meshes: [],
                materials: [],
                accessors: [],
                bufferViews: [],
                buffers: []
            };

            let bufferData = { buffers: [], currentOffset: 0 };

            // Process scene
            scene.traverse((object) => {
                if (object.isMesh) {
                    bufferData = this.processMesh(object, gltf, bufferData);
                }
            });

            // Combine all buffers
            let combinedBuffer = new ArrayBuffer(0);
            if (bufferData.buffers && bufferData.buffers.length > 0) {
                const totalLength = bufferData.buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
                combinedBuffer = new ArrayBuffer(totalLength);
                let offset = 0;

                for (const buffer of bufferData.buffers) {
                    new Uint8Array(combinedBuffer, offset, buffer.byteLength).set(new Uint8Array(buffer.buffer));
                    offset += buffer.byteLength;
                }

                gltf.buffers.push({
                    byteLength: combinedBuffer.byteLength
                });
            }

            if (binary) {
                // Create GLB
                this.createGLB(gltf, combinedBuffer, onCompleted);
            } else {
                onCompleted(gltf);
            }

        } catch (error) {
            console.error('GLTFExporter error:', error);
            if (typeof onCompleted === 'function') {
                onCompleted(null);
            }
        }
    }

    processMesh(mesh, gltf, bufferData) {
        const geometry = mesh.geometry;
        const material = mesh.material;

        // Add node
        gltf.nodes.push({
            mesh: gltf.meshes.length
        });

        // Add material
        const materialIndex = gltf.materials.length;
        gltf.materials.push({
            pbrMetallicRoughness: {
                baseColorFactor: [
                    material.color ? material.color.r : 0.5,
                    material.color ? material.color.g : 0.5,
                    material.color ? material.color.b : 0.5,
                    1.0
                ],
                metallicFactor: material.metalness || 0.0,
                roughnessFactor: material.roughness || 0.5
            }
        });

        // Get geometry data
        const positionArray = geometry.getAttribute('position').array;
        const normalArray = geometry.getAttribute('normal').array;
        const positionBuffer = new Float32Array(positionArray);
        const normalBuffer = new Float32Array(normalArray);

        // Current buffer offset
        const currentOffset = bufferData.currentOffset || 0;

        // Add position accessor
        gltf.accessors.push({
            bufferView: gltf.bufferViews.length,
            componentType: 5126, // FLOAT
            count: positionArray.length / 3,
            type: "VEC3",
            max: [
                Math.max(...positionArray.filter((_, i) => i % 3 === 0)),
                Math.max(...positionArray.filter((_, i) => i % 3 === 1)),
                Math.max(...positionArray.filter((_, i) => i % 3 === 2))
            ],
            min: [
                Math.min(...positionArray.filter((_, i) => i % 3 === 0)),
                Math.min(...positionArray.filter((_, i) => i % 3 === 1)),
                Math.min(...positionArray.filter((_, i) => i % 3 === 2))
            ]
        });

        // Add position buffer view
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: currentOffset,
            byteLength: positionBuffer.byteLength,
            target: 34962 // ARRAY_BUFFER
        });

        // Add normal accessor
        gltf.accessors.push({
            bufferView: gltf.bufferViews.length,
            componentType: 5126, // FLOAT
            count: normalArray.length / 3,
            type: "VEC3"
        });

        // Add normal buffer view
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: currentOffset + positionBuffer.byteLength,
            byteLength: normalBuffer.byteLength,
            target: 34962 // ARRAY_BUFFER
        });

        // Add mesh
        gltf.meshes.push({
            primitives: [{
                attributes: {
                    POSITION: gltf.accessors.length - 2,
                    NORMAL: gltf.accessors.length - 1
                },
                material: materialIndex
            }]
        });

        // Store buffer data for later combination
        bufferData.buffers = bufferData.buffers || [];
        bufferData.buffers.push(positionBuffer, normalBuffer);
        bufferData.currentOffset = currentOffset + positionBuffer.byteLength + normalBuffer.byteLength;

        return bufferData;
    }

    // combineBuffers method removed - now handled inline in parse method

    createGLB(gltf, bufferArrayBuffer, onCompleted) {
        const jsonString = JSON.stringify(gltf);
        const jsonBuffer = new TextEncoder().encode(jsonString);

        // Pad JSON to 4-byte boundary
        const jsonPadding = (4 - (jsonBuffer.byteLength % 4)) % 4;
        const paddedJsonLength = jsonBuffer.byteLength + jsonPadding;

        // Pad binary data to 4-byte boundary
        const binaryPadding = (4 - (bufferArrayBuffer.byteLength % 4)) % 4;
        const paddedBinaryLength = bufferArrayBuffer.byteLength + binaryPadding;

        // GLB structure: header + JSON chunk + binary chunk
        const headerLength = 12;
        const jsonChunkHeader = 8;
        const binaryChunkHeader = 8;
        const totalLength = headerLength + jsonChunkHeader + paddedJsonLength + binaryChunkHeader + paddedBinaryLength;

        const glbBuffer = new ArrayBuffer(totalLength);
        const dataView = new DataView(glbBuffer);
        const uint8Array = new Uint8Array(glbBuffer);

        let offset = 0;

        // GLB header
        dataView.setUint32(offset, 0x46546C67, true); // 'glTF'
        offset += 4;
        dataView.setUint32(offset, 2, true); // version
        offset += 4;
        dataView.setUint32(offset, totalLength, true); // total length
        offset += 4;

        // JSON chunk header
        dataView.setUint32(offset, paddedJsonLength, true); // chunk length
        offset += 4;
        dataView.setUint32(offset, 0x4E4F534A, true); // 'JSON'
        offset += 4;

        // JSON data
        uint8Array.set(jsonBuffer, offset);
        offset += jsonBuffer.byteLength;

        // JSON padding
        for (let i = 0; i < jsonPadding; i++) {
            uint8Array[offset + i] = 0x20; // space
        }
        offset += jsonPadding;

        // Binary chunk header
        if (bufferArrayBuffer.byteLength > 0) {
            dataView.setUint32(offset, paddedBinaryLength, true); // chunk length
            offset += 4;
            dataView.setUint32(offset, 0x004E4942, true); // 'BIN\0'
            offset += 4;

            // Binary data
            uint8Array.set(new Uint8Array(bufferArrayBuffer), offset);
            offset += bufferArrayBuffer.byteLength;

            // Binary padding
            for (let i = 0; i < binaryPadding; i++) {
                uint8Array[offset + i] = 0;
            }
        }

        onCompleted(glbBuffer);
    }
}

// Export for global use
window.GLTFExporter = GLTFExporter;
