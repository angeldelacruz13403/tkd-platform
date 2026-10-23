const baseConfig = require('./app.json').expo;

const isTrainer = process.env.EXPO_PUBLIC_APP_VARIANT === 'trainer';

module.exports = {
  expo: {
    ...baseConfig,
    name: isTrainer ? 'TKD Coach Hub' : baseConfig.name,
    slug: baseConfig.slug,
    android: {
      ...baseConfig.android,
      package: isTrainer ? 'com.taekwondo.globalhub.trainer' : baseConfig.android.package,
    },
  },
};
