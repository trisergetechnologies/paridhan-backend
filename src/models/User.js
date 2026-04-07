import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true
    },
    fullName: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: "India" },
    isDefault: { type: Boolean, default: false }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ================= BASIC IDENTITY =================
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      minlength: 6,
      select: false,
    },

    // ================= BUSINESS ROLES =================
    role: {
      type: String,
      enum: ["customer", "admin", "staff", "seller"],
      default: "customer",
    },
    roles: {
      type: [String],
      enum: ["customer", "admin", "staff", "seller"],
      default: ["customer"],
    },

    // ================= PROFILE =================
    avatar: {
      type: String,
      default: "",
    },
    
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    addresses: [addressSchema],

    // ================= ACCOUNT STATUS =================
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    // ================= SECURITY =================
    lastLoginAt: Date,
    passwordChangedAt: Date,

    // ================= SOFT DELETE =================
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// ================= PASSWORD HASH =================
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Keep backwards compatibility while migrating from single-role to multi-role users.
userSchema.pre("validate", function () {
  if ((!this.roles || this.roles.length === 0) && this.role) {
    this.roles = [this.role];
  }
  if (this.roles && this.roles.length > 0) {
    if (this.role && !this.roles.includes(this.role)) {
      this.roles.push(this.role);
    }
    this.roles = Array.from(new Set(this.roles));
  }
  if (!this.role && this.roles?.length) {
    this.role = this.roles[0];
  }
});

// ================= PASSWORD MATCH =================
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
