module.exports = {
  appId: 'com.aec.manager',
  productName: 'AEC-Manager',
  directories: {
    output: 'dist_electron',
  },
  files: [
    'dist/**/*',
    'electron-main.cjs',
    'preload.cjs',
    'package.json',
    'node_modules/**/*'
  ],
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
  },
  portable: {
    artifactName: 'AEC-Manager.exe',
  },
  compression: 'maximum',
  asar: true,
};
