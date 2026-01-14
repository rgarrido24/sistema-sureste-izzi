import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sistema-sureste';

async function corregirRolUsuario() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const username = process.argv[2] || 'gperez';
    const nuevoRol = process.argv[3] || 'usuarios';

    console.log(`\nBuscando usuario: ${username}`);
    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      console.log(`❌ Usuario "${username}" no encontrado`);
      process.exit(1);
    }

    console.log(`Usuario encontrado:`);
    console.log(`  - Nombre: ${user.name}`);
    console.log(`  - Usuario: ${user.username}`);
    console.log(`  - Rol actual: ${user.role}`);
    console.log(`  - Nuevo rol: ${nuevoRol}`);

    if (user.role === nuevoRol) {
      console.log(`\n✅ El usuario ya tiene el rol "${nuevoRol}"`);
      process.exit(0);
    }

    user.role = nuevoRol;
    await user.save();

    console.log(`\n✅ Rol actualizado correctamente`);
    console.log(`   Usuario: ${user.username}`);
    console.log(`   Nuevo rol: ${user.role}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

corregirRolUsuario();
