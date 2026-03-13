import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['ADM', 'JOGADOR'],
      default: 'JOGADOR',
      required: true
    },
    position: {
      type: String,
      enum: ['ZAGUEIRO', 'MEIA', 'ATACANTE']
    },
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED'],
      default: 'APPROVED',
      required: true
    },
    initialRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
      required: true
    },
    ratingAverage: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
      required: true
    },
    totalGoals: {
      type: Number,
      default: 0
    },
    totalAssists: {
      type: Number,
      default: 0
    },
    totalWins: {
      type: Number,
      default: 0
    },
    totalDraws: {
      type: Number,
      default: 0
    },
    totalLosses: {
      type: Number,
      default: 0
    },
    totalCraquePoints: {
      type: Number,
      default: 0
    },
    totalCraqueFirstPlaces: {
      type: Number,
      default: 0
    },
    totalCraqueSecondPlaces: {
      type: Number,
      default: 0
    },
    totalCraqueThirdPlaces: {
      type: Number,
      default: 0
    },
    totalTournamentTitles: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  }
});

export const User = mongoose.model('User', userSchema);
