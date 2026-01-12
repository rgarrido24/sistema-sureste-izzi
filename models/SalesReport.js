import mongoose from 'mongoose';

const salesReportSchema = new mongoose.Schema({
  title: String,
  description: String,
  data: mongoose.Schema.Types.Mixed,
  createdBy: String,
  module: String
}, {
  timestamps: true
});

export default mongoose.model('SalesReport', salesReportSchema, 'sales_reports');

