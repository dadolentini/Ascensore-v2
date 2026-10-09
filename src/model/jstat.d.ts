declare module 'jstat' {
  interface JStatApi {
    normal: { cdf(x:number,mean:number,sd:number):number };
    studentt: { inv(probability:number,degreesOfFreedom:number):number };
  }
  const library: {jStat:JStatApi};
  export default library;
}
