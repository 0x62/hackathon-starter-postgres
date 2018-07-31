const passport = require('passport');
const request = require('request');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const { Strategy: TwitterStrategy } = require('passport-twitter');
const { Strategy: GitHubStrategy } = require('passport-github');
const { OAuth2Strategy: GoogleStrategy } = require('passport-google-oauth');
const { Strategy: LinkedInStrategy } = require('passport-linkedin-oauth2');
const { Strategy: OpenIDStrategy } = require('passport-openid');
const { OAuthStrategy } = require('passport-oauth');
const { OAuth2Strategy } = require('passport-oauth');

const { User } = require('../models');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User
    .findById(id).then(user => done(null, user))
    .catch(done)
});

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  User
    .findOne({
      where: {
        email: email.toLowerCase()
      }
    })
    .then(user => {
      if (!user) {
        return done(null, false, { msg: `Invalid email or password` });
      }
      
      return user
        .comparePassword(password)
        .then(match => {
          if (match) return done(null, user)
          return done(null, false, { msg: 'Invalid email or password' })
        })
    })
    .catch(done)
}));

/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */

/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_ID,
  clientSecret: process.env.FACEBOOK_SECRET,
  callbackURL: '/auth/facebook/callback',
  profileFields: ['name', 'email', 'link', 'locale', 'timezone', 'gender'],
  passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    return User
      .findOne({
        where: {
          facebook: profile.id
        }
      })
      .then(existingUser => {
        if (existingUser) {
          req.flash('errors', { msg: 'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
          return done()
        }

        const user = req.user
        const providerToken = ProviderToken.build({
          userId: user.id,
          kind: 'facebook',
          accessToken
        })

        user.facebook = profile.id

        Promise
          .all([
            user.save(),
            providerToken.save()
          ])
          .then(([user, token]) => {
            req.flash('info', { msg: 'Facebook account has been linked.' });
            done(null, user);
          })
      })
      .catch(done)
  }

  User
    .findOne({
      where: {
        facebook: profile.id
      }
    })
    .then(existingUser => {
      if (existingUser) {
        return done(null, existingUser)
      }

      User
        .findOne({
          where: {
            email: provile._json.email
          }
        })
        .then(existingEmailUser => {
          if (existingEmailUser) {
            req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Facebook manually from Account Settings.' });
            return done();
          }

          User.create({
            email: provile._json.email,
            facebook: profile.id,
            profileName: `${profile.name.givenName} ${profile.name.familyName}`,
            profileGender: profile._json.gender,
            profilePicture: `https://graph.facebook.com/${profile.id}/picture?type=large`,
            profileLocation: (profile._json.location) ? profile._json.location.name : '',
            providerTokens: [
              { kind: 'facebook', accessToken }
            ]
          }, {
            include: [ ProviderToken ]
          }).then(user => {
            done(null, user)
          })
        })
    })
    .catch(done)
}));

/**
 * Sign in with GitHub.
 */
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_ID,
  clientSecret: process.env.GITHUB_SECRET,
  callbackURL: '/auth/github/callback',
  passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    User.findOne({ github: profile.id }, (err, existingUser) => {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a GitHub account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, (err, user) => {
          if (err) { return done(err); }
          user.github = profile.id;
          user.tokens.push({ kind: 'github', accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.picture = user.profile.picture || profile._json.avatar_url;
          user.profile.location = user.profile.location || profile._json.location;
          user.profile.website = user.profile.website || profile._json.blog;
          user.save((err) => {
            req.flash('info', { msg: 'GitHub account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ github: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        return done(null, existingUser);
      }
      User.findOne({ email: profile._json.email }, (err, existingEmailUser) => {
        if (err) { return done(err); }
        if (existingEmailUser) {
          req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with GitHub manually from Account Settings.' });
          done(err);
        } else {
          const user = new User();
          user.email = profile._json.email;
          user.github = profile.id;
          user.tokens.push({ kind: 'github', accessToken });
          user.profile.name = profile.displayName;
          user.profile.picture = profile._json.avatar_url;
          user.profile.location = profile._json.location;
          user.profile.website = profile._json.blog;
          user.save((err) => {
            done(err, user);
          });
        }
      });
    });
  }
}));

// Sign in with Twitter.

passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_KEY,
  consumerSecret: process.env.TWITTER_SECRET,
  callbackURL: '/auth/twitter/callback',
  passReqToCallback: true
}, (req, accessToken, tokenSecret, profile, done) => {
  if (req.user) {
    User.findOne({ twitter: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Twitter account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, (err, user) => {
          if (err) { return done(err); }
          user.twitter = profile.id;
          user.tokens.push({ kind: 'twitter', accessToken, tokenSecret });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.location = user.profile.location || profile._json.location;
          user.profile.picture = user.profile.picture || profile._json.profile_image_url_https;
          user.save((err) => {
            if (err) { return done(err); }
            req.flash('info', { msg: 'Twitter account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ twitter: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        return done(null, existingUser);
      }
      const user = new User();
      // Twitter will not provide an email address.  Period.
      // But a person’s twitter username is guaranteed to be unique
      // so we can "fake" a twitter email address as follows:
      user.email = `${profile.username}@twitter.com`;
      user.twitter = profile.id;
      user.tokens.push({ kind: 'twitter', accessToken, tokenSecret });
      user.profile.name = profile.displayName;
      user.profile.location = profile._json.location;
      user.profile.picture = profile._json.profile_image_url_https;
      user.save((err) => {
        done(err, user);
      });
    });
  }
}));

/**
 * Sign in with Google.
 */
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_ID,
  clientSecret: process.env.GOOGLE_SECRET,
  callbackURL: '/auth/google/callback',
  passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    User.findOne({ google: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Google account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, (err, user) => {
          if (err) { return done(err); }
          user.google = profile.id;
          user.tokens.push({ kind: 'google', accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || profile._json.image.url;
          user.save((err) => {
            req.flash('info', { msg: 'Google account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ google: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        return done(null, existingUser);
      }
      User.findOne({ email: profile.emails[0].value }, (err, existingEmailUser) => {
        if (err) { return done(err); }
        if (existingEmailUser) {
          req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Google manually from Account Settings.' });
          done(err);
        } else {
          const user = new User();
          user.email = profile.emails[0].value;
          user.google = profile.id;
          user.tokens.push({ kind: 'google', accessToken });
          user.profile.name = profile.displayName;
          user.profile.gender = profile._json.gender;
          user.profile.picture = profile._json.image.url;
          user.save((err) => {
            done(err, user);
          });
        }
      });
    });
  }
}));

/**
 * Sign in with LinkedIn.
 */
passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_ID,
  clientSecret: process.env.LINKEDIN_SECRET,
  callbackURL: process.env.LINKEDIN_CALLBACK_URL,
  scope: ['r_basicprofile', 'r_emailaddress'],
  passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    User.findOne({ linkedin: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a LinkedIn account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, (err, user) => {
          if (err) { return done(err); }
          user.linkedin = profile.id;
          user.tokens.push({ kind: 'linkedin', accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.location = user.profile.location || profile._json.location.name;
          user.profile.picture = user.profile.picture || profile._json.pictureUrl;
          user.profile.website = user.profile.website || profile._json.publicProfileUrl;
          user.save((err) => {
            if (err) { return done(err); }
            req.flash('info', { msg: 'LinkedIn account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ linkedin: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        return done(null, existingUser);
      }
      User.findOne({ email: profile._json.emailAddress }, (err, existingEmailUser) => {
        if (err) { return done(err); }
        if (existingEmailUser) {
          req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with LinkedIn manually from Account Settings.' });
          done(err);
        } else {
          const user = new User();
          user.linkedin = profile.id;
          user.tokens.push({ kind: 'linkedin', accessToken });
          user.email = profile._json.emailAddress;
          user.profile.name = profile.displayName;
          user.profile.location = profile._json.location.name;
          user.profile.picture = profile._json.pictureUrl;
          user.profile.website = profile._json.publicProfileUrl;
          user.save((err) => {
            done(err, user);
          });
        }
      });
    });
  }
}));

/**
 * Tumblr API OAuth.
 */
passport.use('tumblr', new OAuthStrategy({
  requestTokenURL: 'https://www.tumblr.com/oauth/request_token',
  accessTokenURL: 'https://www.tumblr.com/oauth/access_token',
  userAuthorizationURL: 'https://www.tumblr.com/oauth/authorize',
  consumerKey: process.env.TUMBLR_KEY,
  consumerSecret: process.env.TUMBLR_SECRET,
  callbackURL: '/auth/tumblr/callback',
  passReqToCallback: true
},
(req, token, tokenSecret, profile, done) => {
  User.findById(req.user._id, (err, user) => {
    if (err) { return done(err); }
    user.tokens.push({ kind: 'tumblr', accessToken: token, tokenSecret });
    user.save((err) => {
      done(err, user);
    });
  });
}));

/**
 * Foursquare API OAuth.
 */
passport.use('foursquare', new OAuth2Strategy({
  authorizationURL: 'https://foursquare.com/oauth2/authorize',
  tokenURL: 'https://foursquare.com/oauth2/access_token',
  clientID: process.env.FOURSQUARE_ID,
  clientSecret: process.env.FOURSQUARE_SECRET,
  callbackURL: process.env.FOURSQUARE_REDIRECT_URL,
  passReqToCallback: true
},
(req, accessToken, refreshToken, profile, done) => {
  User.findById(req.user._id, (err, user) => {
    if (err) { return done(err); }
    user.tokens.push({ kind: 'foursquare', accessToken });
    user.save((err) => {
      done(err, user);
    });
  });
}));

/**
 * Steam API OpenID.
 */
passport.use(new OpenIDStrategy({
  apiKey: process.env.STEAM_KEY,
  providerURL: 'http://steamcommunity.com/openid',
  returnURL: `${process.env.BASE_URL}/auth/steam/callback`,
  realm: `${process.env.BASE_URL}/`,
  stateless: true,
  passReqToCallback: true,
}, (req, identifier, done) => {
  const steamId = identifier.match(/\d+$/)[0];
  const profileURL = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.STEAM_KEY}&steamids=${steamId}`;

  if (req.user) {
    User.findOne({ steam: steamId }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        req.flash('errors', { msg: 'There is already an account associated with the SteamID. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, (err, user) => {
          if (err) { return done(err); }
          user.steam = steamId;
          user.tokens.push({ kind: 'steam', accessToken: steamId });
          request(profileURL, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              const data = JSON.parse(body);
              const profile = data.response.players[0];
              user.profile.name = user.profile.name || profile.personaname;
              user.profile.picture = user.profile.picture || profile.avatarmedium;
              user.save((err) => {
                done(err, user);
              });
            } else {
              user.save((err) => { done(err, user); });
              done(error, null);
            }
          });
        });
      }
    });
  } else {
    request(profileURL, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        const data = JSON.parse(body);
        const profile = data.response.players[0];

        const user = new User();
        user.steam = steamId;
        user.email = `${steamId}@steam.com`; // steam does not disclose emails, prevent duplicate keys
        user.tokens.push({ kind: 'steam', accessToken: steamId });
        user.profile.name = profile.personaname;
        user.profile.picture = profile.avatarmedium;
        user.save((err) => {
          done(err, user);
        });
      } else {
        done(error, null);
      }
    });
  }
}));

/**
 * Pinterest API OAuth.
 */
passport.use('pinterest', new OAuth2Strategy({
  authorizationURL: 'https://api.pinterest.com/oauth/',
  tokenURL: 'https://api.pinterest.com/v1/oauth/token',
  clientID: process.env.PINTEREST_ID,
  clientSecret: process.env.PINTEREST_SECRET,
  callbackURL: process.env.PINTEREST_REDIRECT_URL,
  passReqToCallback: true
},
(req, accessToken, refreshToken, profile, done) => {
  User.findById(req.user._id, (err, user) => {
    if (err) { return done(err); }
    user.tokens.push({ kind: 'pinterest', accessToken });
    user.save((err) => {
      done(err, user);
    });
  });
}));

/**
 * Login Required middleware.
 */
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = (req, res, next) => {
  const provider = req.path.split('/').slice(-1)[0];
  const token = req.user.tokens.find(token => token.kind === provider);
  if (token) {
    next();
  } else {
    res.redirect(`/auth/${provider}`);
  }
};
