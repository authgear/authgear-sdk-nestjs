import 'reflect-metadata';
import { Public } from '../src/decorators/public.decorator';
import { IS_PUBLIC_KEY } from '../src/authgear.constants';

describe('@Public()', () => {
  it('sets the public metadata flag to true on a method', () => {
    class Controller {
      @Public()
      handler() {}
    }
    const value = Reflect.getMetadata(IS_PUBLIC_KEY, Controller.prototype.handler);
    expect(value).toBe(true);
  });
});
