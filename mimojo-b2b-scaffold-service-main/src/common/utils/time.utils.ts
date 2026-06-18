import moment from 'moment';

const timeUtils = {
  toDubaiTime(date: string | null, format = 'YYYY-MM-DD h:mm a') {
    if (!date) {
      return null;
    }
    const momentDate = moment.utc(date);

    // Add 4 hours to convert to Dubai time (UTC+4)
    const dubaiDateTime = momentDate.utcOffset('+04:00');
    return dubaiDateTime.format(format);
  },

  // find the difference in hours between the current time and the given time
  differenceInHours(dateFrom: string): number | null {
    const currentTime = moment();
    const latestUpdateTime = dateFrom ? moment(dateFrom) : null;
    const updatedTimeDifference = latestUpdateTime ? currentTime.diff(latestUpdateTime, 'hours') : null;
    return updatedTimeDifference;
  },

  // find the difference in minutes between the current time and the given time
  differenceInMinutes(dateFrom: string): number | null {
    const currentTime = moment();
    const latestUpdateTime = dateFrom ? moment(dateFrom) : null;
    const updatedTimeDifference = latestUpdateTime ? currentTime.diff(latestUpdateTime, 'minutes') : null;
    return updatedTimeDifference;
  },

  // Check if the difference in minutes is within the given minutes
  isMinutesDifferenceWithin(dateFrom: string | null, minutes: number): boolean {
    const updatedTimeDifference = dateFrom ? this.differenceInMinutes(dateFrom) : null;
    return updatedTimeDifference === null ? false : updatedTimeDifference <= minutes;
  },
};

export default timeUtils;
