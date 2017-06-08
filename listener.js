const googleCloud = require('google-cloud');
const configUtil = require('./config/configUtil');
const fetchCredentials = require('./fetchCredentials');

/** Class that allows you to listen to a number of Dow Jones PubSub subscriptions. This is a singleton. */
class Listener {

  initialize(credentials) {
    this.gCloudProject = googleCloud({ project_id: credentials.project_id, credentials });
    this.project_id = credentials.project_id;
    this.defaultSubscriptions = this.getConfigUtil().getSubscriptions();
  }

  /**
   * This callback type is called `subscriptionOnMessageCallback` and is displayed as part of this class.
   *
   * @callback Subscriber~subscriptionOnMessageCallback
   * @param {object} message - The actual Google pubsub message from published from the server and subscribed to by this function.
   * @param {string} topic - The message's topic
   */

  /**
   * This function allows you to listen to messages from a subscription.
   *
   * @param {subscriptionOnMessageCallback} onMessageCallback - The callback that handles the topic message when it arrives.
   * @param {string[]=['<your subscription ID here>']} [subscriptions] - [Optional] collection of subscriptions you wish to listen to. Defaults to the subscriptions listed in your credentials security file.
   * Leave as null or undefined if you
   * want to use the default.
   */
  listen(onMessageCallback, subscriptions) {
    return this.getCredentials().then((credentials) => {
      this.initialize(credentials);
      this.readyListener(onMessageCallback, subscriptions);
      return true;
    }).catch((err) => {
      console.log(`Encountered an error attempting to get cloud credentials on behalf of customer: ${err.message}`);
      return false;
    });
  }

  getConfigUtil() {
    return configUtil;
  }

  getCredentials() {
    return fetchCredentials();
  }

  getPubSubClient() {
    return this.gCloudProject.pubsub({ projectId: this.project_id });
  }

  readyListener(onMessageCallback, subscriptionIds) {
    const pubsubClient = this.getPubSubClient();
    const subs = subscriptionIds || this.defaultSubscriptions;

    if (!subs || subs.length <= 0) {
      throw new Error('No subscriptions specified. You must specify subscriptions when calling the \'listen\' function.');
    }

    subs.forEach((subscription) => {
      console.log(`Listening to subscription: ${subscription}`);

      const onMessage = (msg) => {
        msg.skip();
        return onMessageCallback(msg);
      };

      const pubsubSubscription = pubsubClient.subscription(subscription);

      pubsubSubscription.get().then((data) => {
        const pubsubSub = data[0];
        pubsubSub.on('message', onMessage);
        pubsubSub.on('error', (subErr) => {
          console.log(`On Subscription Error: ${subErr}`);
          pubsubSub.removeListener('message', onMessage);
          pubsubSub.on('message', onMessage);
        });
      }).catch((err) => {
        console.log(`Error retrieving subscription from Google PubSub: ${err}`);
      });
    });
    console.log('Listeners for subscriptions have been configured, set and await message arrival.');
  }
}

module.exports = new Listener();
