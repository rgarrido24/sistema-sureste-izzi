// Huellas SHA-256 (no los valores) de credenciales que estuvieron publicadas en el repositorio.
// El servidor las rechaza / avisa aunque sigan configuradas, para forzar su rotación.
export const HASHES_COMPROMETIDOS = {
  jwt: ["f0a230c00e25628d84c8f79045867fc4440b2c7ef8c2d8e5d2f06f270a5e1578"],
  mongoPassword: ["0fc8e4aa7662c4566d81bbf1d92dd85e33be8c5cb41b76309e6e0c4b7d9534d2"],
};
