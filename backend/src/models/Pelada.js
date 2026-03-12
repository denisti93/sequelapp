import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    score: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const playerStatSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    goals: {
      type: Number,
      default: 0,
      min: 0
    },
    assists: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    _id: false
  }
);

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    goalkeepers: [
      {
        type: String,
        trim: true
      }
    ],
    wins: {
      type: Number,
      default: 0,
      min: 0
    },
    draws: {
      type: Number,
      default: 0,
      min: 0
    },
    losses: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: false
  }
);

const peladaSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    teams: [teamSchema],
    playerStats: [playerStatSchema],
    votingStatus: {
      type: String,
      enum: ['CLOSED', 'OPEN', 'FINISHED'],
      default: 'CLOSED',
      required: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'CONCLUDED'],
      default: 'OPEN',
      required: true
    },
    votes: [voteSchema]
  },
  {
    timestamps: true
  }
);

peladaSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Pelada = mongoose.model('Pelada', peladaSchema);
