import Sqids from 'sqids'

export const idToSqid = (id:number, length:number = 5): string => {
  const sqids = new Sqids({minLength: length, alphabet: 'UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0',})
  return sqids.encode(id.toString().split('').map(char => parseInt(char, 10)))
}

export const sqidToId = (sqid:string, length:number = 5): number => {
  const sqids = new Sqids({minLength: length, alphabet: 'UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0',})
  if(sqid.length != length) return 0;
  return parseInt(sqids.decode(sqid).join(), 10)
}

const LOG = (a) => console.log(a)
