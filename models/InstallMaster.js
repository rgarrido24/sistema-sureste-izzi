import mongoose from 'mongoose';

const installMasterSchema = new mongoose.Schema({}, {
  timestamps: true,
  strict: false
});

export default mongoose.model('InstallMaster', installMasterSchema, 'install_master');

