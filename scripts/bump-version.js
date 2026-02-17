const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Please specify a version (e.g., 0.2.0)');
  process.exit(1);
}

// Helper to update JSON files
const updateJson = (relPath, updateFn) => {
    try {
        const filePath = path.join(__dirname, '..', relPath);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        updateFn(data);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        console.log(`Updated ${relPath} to ${version}`);
    } catch (e) {
        console.error(`Failed to update ${relPath}:`, e);
    }
};

// Update package.json
updateJson('package.json', (data) => {
    data.version = version;
});

// Update tauri.conf.json
updateJson('src-tauri/tauri.conf.json', (data) => {
    data.version = version;
});


try {
    const cargoPath = path.join(__dirname, '../src-tauri/Cargo.toml');
    let cargoToml = fs.readFileSync(cargoPath, 'utf8');
    // Using simple regex for top-level version
    cargoToml = cargoToml.replace(/^version = ".*"/m, `version = "${version}"`);
    fs.writeFileSync(cargoPath, cargoToml);
    console.log(`Updated src-tauri/Cargo.toml to ${version}`);
} catch (e) {
    console.error(`Failed to update Cargo.toml:`, e);
}
