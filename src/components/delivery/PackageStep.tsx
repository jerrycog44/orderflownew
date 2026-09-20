import React, { useState } from 'react';
import { Upload, X, ArrowRight } from 'lucide-react';
import type { PackageDetails, PackageType } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

export interface PackageStepProps {
  initialData: PackageDetails;
  onNext: (data: PackageDetails) => void;
}

const CATEGORY_OPTIONS = [
  { value: 'Fashion & Apparel', label: 'Fashion & Apparel' },
  { value: 'Electronics & Gadgets', label: 'Electronics & Gadgets' },
  { value: 'Beauty & Personal Care', label: 'Beauty & Personal Care' },
  { value: 'Food & Groceries', label: 'Food & Groceries' },
  { value: 'Documents & Office', label: 'Documents & Office Supplies' },
  { value: 'Automotive Parts', label: 'Automotive & Hardware' },
  { value: 'General Goods', label: 'General Goods' },
  { value: 'Other', label: 'Other' },
];

const PACKAGE_TYPES: { value: PackageType; label: string }[] = [
  { value: 'parcel', label: 'Parcel' },
  { value: 'box', label: 'Box / Carton' },
  { value: 'bag', label: 'Bag / Sack' },
  { value: 'fragile_item', label: 'Fragile Item' },
  { value: 'other', label: 'Other' },
];

export const PackageStep: React.FC<PackageStepProps> = ({ initialData, onNext }) => {
  const [formData, setFormData] = useState<PackageDetails>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof PackageDetails, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleDimensionsChange = (dimKey: 'length' | 'width' | 'height', val: number) => {
    setFormData((prev) => ({
      ...prev,
      dimensionsCm: {
        ...prev.dimensionsCm,
        [dimKey]: val >= 0 ? val : 0,
      },
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, imageUrl: 'Image size should be under 5MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      handleChange('imageUrl', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required.';
    }
    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be at least 1.';
    }
    if (!formData.weightKg || formData.weightKg <= 0) {
      newErrors.weightKg = 'Please enter a valid weight in kg.';
    }
    if (
      !formData.dimensionsCm.length ||
      !formData.dimensionsCm.width ||
      !formData.dimensionsCm.height
    ) {
      newErrors.dimensions = 'All dimensions (L × W × H) are required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Step 1: Package Information
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Tell us about the item you need delivered.
        </p>
      </div>

      {/* Main Details Section */}
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <Input
          label="Product Name *"
          placeholder="e.g. Leather Sneakers & Jackets"
          value={formData.productName}
          onChange={(e) => handleChange('productName', e.target.value)}
          error={errors.productName}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <Select
            label="Product Category"
            options={CATEGORY_OPTIONS}
            value={formData.itemCategory}
            onChange={(e) => handleChange('itemCategory', e.target.value)}
          />

          <Input
            label="Package Quantity *"
            type="number"
            min={1}
            value={formData.quantity}
            onChange={(e) => handleChange('quantity', parseInt(e.target.value, 10) || 1)}
            error={errors.quantity}
          />
        </div>

        {/* Product Image Upload Section */}
        <div className="of-form-field">
          <label className="of-form-label">Product Image (Optional preview)</label>
          {formData.imageUrl ? (
            <div
              style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--color-border-strong)',
              }}
            >
              <img src={formData.imageUrl} alt="Product Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => handleChange('imageUrl', '')}
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Remove Image"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-6)',
                border: '2px dashed var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                backgroundColor: 'var(--color-bg-subtle)',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              <Upload size={24} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-2)' }} />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                Click to upload product photo
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                PNG, JPG or WEBP (Max 5MB)
              </span>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          )}
          {errors.imageUrl && <p className="of-form-error-msg">{errors.imageUrl}</p>}
        </div>
      </div>

      {/* Dimensions & Package Type */}
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Weight & Dimensions
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <Input
            label="Est. Weight (kg) *"
            type="number"
            step="0.1"
            min={0.1}
            placeholder="e.g. 1.5"
            value={formData.weightKg || ''}
            onChange={(e) => handleChange('weightKg', parseFloat(e.target.value) || 0)}
            error={errors.weightKg}
          />

          <div className="of-form-field">
            <label className="of-form-label">Package Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {PACKAGE_TYPES.map((pt) => {
                const isSelected = formData.packageType === pt.value;
                return (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => handleChange('packageType', pt.value)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 500,
                      border: `1.5px solid ${isSelected ? 'var(--color-brand-accent)' : 'var(--color-border-default)'}`,
                      backgroundColor: isSelected ? 'var(--color-brand-accent-light)' : 'var(--color-bg-surface)',
                      color: isSelected ? 'var(--color-brand-accent)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {pt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dimensions Inputs */}
        <div className="of-form-field">
          <label className="of-form-label">Dimensions (L × W × H in cm) *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            <Input
              placeholder="Length"
              type="number"
              min={1}
              value={formData.dimensionsCm.length || ''}
              onChange={(e) => handleDimensionsChange('length', parseInt(e.target.value, 10) || 0)}
            />
            <Input
              placeholder="Width"
              type="number"
              min={1}
              value={formData.dimensionsCm.width || ''}
              onChange={(e) => handleDimensionsChange('width', parseInt(e.target.value, 10) || 0)}
            />
            <Input
              placeholder="Height"
              type="number"
              min={1}
              value={formData.dimensionsCm.height || ''}
              onChange={(e) => handleDimensionsChange('height', parseInt(e.target.value, 10) || 0)}
            />
          </div>
          {errors.dimensions && <p className="of-form-error-msg">{errors.dimensions}</p>}
        </div>

        {/* Fragile checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', marginTop: 'var(--space-1)' }}>
          <input
            type="checkbox"
            checked={formData.fragile}
            onChange={(e) => handleChange('fragile', e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-brand-accent)' }}
          />
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Fragile item (Requires gentle handling)
          </span>
        </label>

        <Textarea
          label="Special Handling Notes (Optional)"
          placeholder="e.g. Keep upright, glass container inside."
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={2}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Button variant="primary" size="lg" type="submit" rightIcon={<ArrowRight size={18} />}>
          Continue to Pickup & Delivery
        </Button>
      </div>
    </form>
  );
};
